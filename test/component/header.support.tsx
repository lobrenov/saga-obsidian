import { useEffect, useReducer, useState } from 'react'
import { render } from 'vitest-browser-react'
import type { TFile } from 'obsidian'
import { NoteHeader } from '../../src/header/NoteHeader'
import type { HeaderEnv } from '../../src/header/env'
import { frontmatterOf } from '../../src/obsidian/vault'
import { createRendererResolver } from '../../src/shared/renderers/resolve'
import { parseConfig, type Config } from '../../src/shared/schemas/config'
import { HeaderFakeApp, testEnv } from '../fakes/header'

export const ADA = `---
type: character
portrait: "[[portrait.png]]"
title: Mathematician
location: "[[Waterdeep]]"
status: alive
---
# Ada Lovelace
`

export const FILES: Record<string, string> = {
  'Places/Waterdeep.md': '---\ntype: location\n---\n',
  'Characters/Bob.md': '---\ntype: character\n---\n',
  'Factions/Harbor Guild.md': '---\ntype: guild\n---\n',
  'Attachments/portrait.png': '',
  'Attachments/coast.jpg': ''
}

export const DEFAULT_CONFIG: Config = parseConfig(null).config

/** Follows the file like the controller: re-reads the frontmatter on each metadata `changed`. */
function Live({ app, env, file, config }: { app: HeaderFakeApp; env: HeaderEnv; file: TFile; config: Config }) {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [properties, setProperties] = useState(false)
  useEffect(() => {
    const ref = app.metadataCache.on('changed', refresh)
    return () => app.metadataCache.offref(ref)
  }, [app])
  const frontmatter = frontmatterOf(app.asApp(), file)
  const resolution = createRendererResolver(config)(frontmatter)
  if (resolution.renderer === 'document') return null
  return (
    <NoteHeader
      env={env}
      file={file}
      frontmatter={frontmatter}
      resolution={{ ...resolution, renderer: resolution.renderer }}
      config={config}
      properties={properties}
      onToggleProperties={() => setProperties(!properties)}
    />
  )
}

/** Renders the header of the note at `path` over a fake vault of `FILES` plus `files`. */
export async function renderHeader(path: string, text: string, options: { files?: Record<string, string>; config?: Config } = {}) {
  const app = new HeaderFakeApp()
  for (const [p, t] of Object.entries({ ...FILES, ...options.files })) app.addFile(p, t)
  const file = app.addFile(path, text)
  const { env, suggesters, hovered } = testEnv(app)
  const screen = await render(<Live app={app} env={env} file={file} config={options.config ?? DEFAULT_CONFIG} />)
  return { screen, app, file, env, suggesters, hovered, text: () => app.text(path) }
}

/** Obsidian's Live Preview markup, as far as `dom.ts` reads it. */
export function liveView(options: { inlineTitle?: boolean } = {}): { containerEl: HTMLElement; sizer: HTMLElement } {
  const containerEl = document.createElement('div')
  containerEl.className = 'workspace-leaf-content'
  containerEl.innerHTML = `<div class="view-content"><div class="markdown-source-view cm-s-obsidian mod-cm6 is-live-preview"><div class="cm-editor"><div class="cm-scroller"><div class="cm-sizer">${
    options.inlineTitle === false ? '' : '<div class="inline-title">Note</div>'
  }<div class="metadata-container"></div><div class="cm-contentContainer"><div class="cm-content"></div></div></div></div></div></div></div>`
  document.body.append(containerEl)
  return { containerEl, sizer: containerEl.querySelector('.cm-sizer') as HTMLElement }
}

/** Obsidian's Reading view markup, as far as `dom.ts` reads it. */
export function readingView(): { containerEl: HTMLElement; sizer: HTMLElement } {
  const containerEl = document.createElement('div')
  containerEl.className = 'workspace-leaf-content'
  containerEl.innerHTML =
    '<div class="view-content"><div class="markdown-reading-view"><div class="markdown-preview-view markdown-rendered"><div class="markdown-preview-sizer markdown-preview-section"><div class="mod-header"><div class="inline-title">Note</div><div class="metadata-container"></div></div><div class="markdown-preview-pusher"></div><div>Body</div></div></div></div></div>'
  document.body.append(containerEl)
  return { containerEl, sizer: containerEl.querySelector('.markdown-preview-sizer') as HTMLElement }
}
