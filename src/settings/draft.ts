import { rendererDefs } from '../shared/renderers/definitions'
import type { Fields } from '../shared/renderers/fields'
import { RENDERER_IDS, type RendererId } from '../shared/renderers/ids'
import { typesOf } from '../shared/renderers/resolve'
import type { Result } from '../shared/result'
import { parseConfig, type Config, type RendererConfig } from '../shared/schemas/config'
import { buildConfigText } from '../shared/schemas/configWrite'

/** The renderers the tab edits; `document` is the fallback and has no types or fields of its own. */
export const EDITABLE_IDS = RENDERER_IDS.filter((id) => id !== 'document')

/** What the tab's inputs hold: `types` is comma-separated, a blank key stands for the field's default. */
export interface Draft {
  typeKey: string
  types: Record<string, string>
  keys: Record<string, Record<string, string>>
}

const fieldsOf = (id: RendererId): Fields => rendererDefs[id].fields

export function draftOf(config: Config): Draft {
  const types: Draft['types'] = {}
  const keys: Draft['keys'] = {}
  for (const id of EDITABLE_IDS) {
    types[id] = typesOf(config, id).join(', ')
    keys[id] = Object.fromEntries(Object.keys(fieldsOf(id)).map((field) => [field, config.renderers[id]?.keys[field] ?? '']))
  }
  return { typeKey: config.typeKey, types, keys }
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

function entryOf(draft: Draft, base: Config, id: RendererId): RendererConfig | undefined {
  const before = base.renderers[id]
  const listed = (draft.types[id] ?? '').split(',').map((type) => type.trim()).filter(Boolean)
  const types = listed.length > 0 ? listed : [id]
  const typesChanged = !same(types, typesOf(base, id))
  const keys: Record<string, string> = {}
  for (const [field, def] of Object.entries(fieldsOf(id))) {
    const value = (draft.keys[id]?.[field] ?? '').trim()
    if (value === (before?.keys[field] ?? '')) {
      if (before && field in before.keys) keys[field] = value
    } else if (value !== '' && value !== def.key) keys[field] = value
  }
  if (!before && !typesChanged && Object.keys(keys).length === 0) return undefined
  return { types: typesChanged ? types : (before?.types ?? []), keys, templates: before?.templates ?? [] }
}

/** The config the draft stands for over `base`: unedited entries (and `document`) stay as `base` has them. */
export function configOf(draft: Draft, base: Config): Config {
  const renderers: Config['renderers'] = { ...base.renderers }
  for (const id of EDITABLE_IDS) {
    const entry = entryOf(draft, base, id)
    if (entry) renderers[id] = entry
    else delete renderers[id]
  }
  return { typeKey: draft.typeKey.trim(), renderers }
}

export const draftIssues = (draft: Draft, base: Config) => parseConfig(configOf(draft, base)).issues

/** The file text after saving `draft` over the file as read (`state.text`); refused with the issues when the config is invalid. */
export const saveText = (state: { config: Config; invalid: readonly RendererId[]; text: string | null }, draft: Draft): Result<string> =>
  buildConfigText(state.text, configOf(draft, state.config), state.config, state.invalid)

export const isDirty = (draft: Draft, base: Config): boolean => !same(draft, draftOf(base))

/** `draft` carried from `previous` to `next`: inputs the user edited keep their value, the rest take `next`'s. */
export function rebase(draft: Draft, previous: Config, next: Config): Draft {
  const was = draftOf(previous)
  const now = draftOf(next)
  const pick = (mine: string, before: string, after: string): string => (mine === before ? after : mine)
  const types: Draft['types'] = {}
  const keys: Draft['keys'] = {}
  for (const id of EDITABLE_IDS) {
    types[id] = pick(draft.types[id] ?? '', was.types[id] ?? '', now.types[id] ?? '')
    keys[id] = Object.fromEntries(
      Object.entries(now.keys[id] ?? {}).map(([field, value]) => [field, pick(draft.keys[id]?.[field] ?? '', was.keys[id]?.[field] ?? '', value)])
    )
  }
  return { typeKey: pick(draft.typeKey, was.typeKey, now.typeKey), types, keys }
}
