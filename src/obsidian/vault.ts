import type { App, Component, Events, MarkdownView, TFile } from 'obsidian'
import { parse } from 'yaml'
import { parseFrontmatter, setFrontmatterKey } from '../shared/frontmatter'
import { rendererLook, type PinLook } from '../shared/pins/look'
import { applyPinOpToText } from '../shared/pins/ops'
import { createRendererResolver, type RendererResolution } from '../shared/renderers/resolve'
import { err, ioError, ok, type Issue, type Result } from '../shared/result'
import { parseConfig, type Config } from '../shared/schemas/config'
import type { RendererId } from '../shared/renderers/ids'
import type { PinOp } from '../shared/schemas/pins'
import { parseWikiLink, type WikiLink } from '../shared/wikilink'

export const CONFIG_PATH = '.saga/renderers.yaml'

type Frontmatter = Readonly<Record<string, unknown>>

/** The note's frontmatter from the metadata cache (`{}` when it has none). */
export function frontmatterOf(app: App, file: TFile): Frontmatter {
  const data = { ...app.metadataCache.getFileCache(file)?.frontmatter }
  delete data.position
  return data
}

/** The file a wikilink (or `[[…]]` string) resolves to from the note at `fromPath`; null when it does not resolve. */
export function resolveLink(app: App, link: WikiLink | string, fromPath: string): TFile | null {
  const parsed = typeof link === 'string' ? parseWikiLink(link) : link
  return parsed ? app.metadataCache.getFirstLinkpathDest(parsed.target, fromPath) : null
}

/** The URL an `<img>` can load the file from. */
export const resourceUrl = (app: App, file: TFile): string => app.vault.getResourcePath(file)

/** Rewrites the note's text with `edit`, keeping the file as is when it refuses. Open editors of the note are saved first so their unsaved text is part of `text`. */
async function editText(app: App, file: TFile, edit: (text: string) => Result<string>): Promise<Result<void>> {
  let failure: Result<string> | undefined
  try {
    for (const leaf of app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view as MarkdownView
      if (view.file === file) await view.save()
    }
    await app.vault.process(file, (text) => {
      const next = edit(text)
      if (next.ok) return next.value
      failure = next
      return text
    })
  } catch (error) {
    return err(ioError(error))
  }
  return failure && !failure.ok ? failure : ok(undefined)
}

/** Sets a frontmatter key, changing only that value's text; `undefined` removes the key. */
export const setField = (app: App, file: TFile, key: string, value: unknown): Promise<Result<void>> =>
  editText(app, file, (text) => setFrontmatterKey(text, key, value))

/** Sets a frontmatter key to `update` of its value as written at write time; `undefined` removes the key. */
export const updateField = (app: App, file: TFile, key: string, update: (current: unknown) => unknown): Promise<Result<void>> =>
  editText(app, file, (text) => {
    const parsed = parseFrontmatter(text)
    const first = parsed.errors[0]
    if (first) return err({ kind: 'parse', message: `Invalid frontmatter: ${first.message}` })
    return setFrontmatterKey(text, key, update(parsed.data[key]))
  })

/** Chooses the op for the note's current raw `map-pins` list, or null when the pin is no longer there. */
export type PinOpBuilder = (list: readonly unknown[]) => PinOp | null

/** Applies the op `build` chooses from the `map-pins` list as written at write time, changing only that value's text. */
export const updatePins = (app: App, file: TFile, build: PinOpBuilder): Promise<Result<void>> =>
  editText(app, file, (text) => {
    const parsed = parseFrontmatter(text)
    const first = parsed.errors[0]
    if (first) return err({ kind: 'parse', message: `Invalid frontmatter: ${first.message}` })
    const list: unknown = parsed.data['map-pins']
    const op = build(Array.isArray(list) ? list : [])
    return op ? applyPinOpToText(text, op) : err({ kind: 'not-found', message: 'That pin is no longer in the note. Its map may have changed.' })
  })

export interface ConfigState {
  config: Config
  issues: Issue[]
  /** Renderers whose entry in the file could not be read. */
  invalid: RendererId[]
  /** The file's text; null when there is no file. */
  text: string | null
}

export interface ConfigStore {
  state(): ConfigState
  /** The renderer a note with this frontmatter gets under the current config. */
  rendererOf(frontmatter: Frontmatter): RendererResolution
  /** The pin look of a renderer's notes: its config `pin` over the built-in defaults. */
  pinLookOf(renderer: RendererId): PinLook
  /** Calls `callback` after each load that changed the file's text; returns the unsubscribe. */
  subscribe(callback: (state: ConfigState) => void): () => void
  reload(): Promise<void>
  /** Replaces the file's text, creating `.saga/` when needed. */
  writeConfig(text: string): Promise<void>
}

function readState(text: string | null): ConfigState {
  if (text === null) return { ...parseConfig(null), text }
  try {
    return { ...parseConfig(parse(text) as unknown), text }
  } catch (error) {
    return { ...parseConfig(null), issues: [{ path: '', message: error instanceof Error ? error.message : 'Invalid YAML' }], text }
  }
}

/** Loads `.saga/renderers.yaml` and reloads it when the file changes on disk (the `raw` vault event; dot-folders are not indexed as files). */
export async function createConfigStore(app: App, owner: Component): Promise<ConfigStore> {
  const adapter = app.vault.adapter
  const listeners = new Set<(state: ConfigState) => void>()
  let state = readState(null)
  let resolver = createRendererResolver(state.config)

  let latest = 0
  const reload = async (): Promise<void> => {
    const run = ++latest
    const text = (await adapter.exists(CONFIG_PATH)) ? await adapter.read(CONFIG_PATH) : null
    if (run !== latest || text === state.text) return
    state = readState(text)
    resolver = createRendererResolver(state.config)
    for (const callback of listeners) {
      try {
        callback(state)
      } catch (error) {
        console.error('Saga: config listener failed', error)
      }
    }
  }

  await reload()
  owner.registerEvent(
    (app.vault as Events).on('raw', (path) => {
      if (path === CONFIG_PATH) void reload()
    })
  )

  return {
    state: () => state,
    rendererOf: (frontmatter) => resolver(frontmatter),
    pinLookOf: (renderer) => rendererLook(renderer, state.config.renderers[renderer]?.pin),
    subscribe(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    reload,
    async writeConfig(text) {
      if (!(await adapter.exists('.saga'))) await adapter.mkdir('.saga')
      await adapter.write(CONFIG_PATH, text)
      await reload()
    }
  }
}
