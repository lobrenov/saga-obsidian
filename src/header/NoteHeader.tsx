import { useId } from 'react'
import type { TFile } from 'obsidian'
import { setField } from '../obsidian/vault'
import type { RendererDef } from '../shared/renderers/define'
import { rendererDefs } from '../shared/renderers/definitions'
import type { RendererResolution } from '../shared/renderers/resolve'
import { typesOf } from '../shared/renderers/resolve'
import type { Config } from '../shared/schemas/config'
import { MenuSelect } from '../ui/MenuSelect'
import { HeaderCtx, useHeader, type HeaderEnv } from './env'
import { Icon } from './Icon'
import { LayoutBoundary } from './LayoutBoundary'
import { NoteTitle } from './NoteTitle'
import { rendererRegistry } from './registry'
import type { HeaderRendererId } from './types'

export interface NoteHeaderProps {
  env: HeaderEnv
  file: TFile
  frontmatter: Readonly<Record<string, unknown>>
  resolution: RendererResolution & { renderer: HeaderRendererId }
  config: Config
  /** The native properties are showing below the header. */
  properties: boolean
  onToggleProperties: () => void
}

const NO_KEYS: Readonly<Record<string, string>> = {}

/** The note's `type` as a selector over the types its renderer draws (a value outside them stays selectable). */
function TypeField({ renderer, current }: { renderer: HeaderRendererId; current: string | null }) {
  const { env, file, config } = useHeader()
  const id = useId()
  const types = typesOf(config, renderer)
  const match = types.find((type) => type.toLowerCase() === current?.toLowerCase())
  const options = match || current === null ? types : [...types, current]
  return (
    <span className="saga-header-type">
      <label htmlFor={id}>Type</label>
      <MenuSelect
        id={id}
        value={match ?? current ?? undefined}
        options={options.map((type) => ({ value: type, label: type }))}
        showMenu={env.showMenu}
        onChange={(type) => void setField(env.app, file, config.typeKey, type)}
      />
    </span>
  )
}

/** The header of a note drawn by a renderer: the renderer's label and type selector, then the layout. */
export function NoteHeader({ env, file, frontmatter, resolution, config, properties, onToggleProperties }: NoteHeaderProps) {
  const { renderer } = resolution
  const def: RendererDef = rendererDefs[renderer]
  const keys = config.renderers[renderer]?.keys ?? NO_KEYS
  const { Layout } = rendererRegistry[renderer]
  const title = <NoteTitle />
  const nameId = useId()

  return (
    <HeaderCtx.Provider value={{ env, file, config, renderer }}>
      <section className="saga-header" data-renderer={renderer} aria-labelledby={nameId}>
        <span id={nameId} hidden>
          {def.label} header
        </span>
        <div className="saga-header-bar">
          <span className="saga-header-badge">
            <Icon name={def.icon} />
            {def.label}
          </span>
          <TypeField renderer={renderer} current={resolution.type} />
          <button type="button" className="saga-header-toggle" aria-pressed={properties} onClick={onToggleProperties}>
            <Icon name="list" />
            Properties
          </button>
        </div>
        <div className="saga-header-body">
          <LayoutBoundary resetKey={`${file.path}:${renderer}`} fallback={title}>
            <Layout title={title} frontmatter={frontmatter} keys={keys} />
          </LayoutBoundary>
        </div>
      </section>
    </HeaderCtx.Provider>
  )
}
