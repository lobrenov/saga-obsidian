import { useId } from 'react'
import type { TFile } from 'obsidian'
import { useBannerPicker } from '../banner/useBannerPicker'
import { removeBanner } from '../banner/useWrite'
import { setField } from '../obsidian/vault'
import { bannerOf, type Banner } from '../shared/renderers/banner'
import type { RendererDef } from '../shared/renderers/define'
import { rendererDefs } from '../shared/renderers/definitions'
import type { RendererResolution } from '../shared/renderers/resolve'
import { allTypes, typesOf } from '../shared/renderers/resolve'
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
  /** Puts the note's banner into reposition mode. */
  onRepositionBanner: () => void
}

const NO_KEYS: Readonly<Record<string, string>> = {}

/** The note's `type` as a selector over the types its renderer draws (a value outside them stays selectable); on a Document card, over every configured type, with "Set type" while none is chosen. */
function TypeField({ renderer, current }: { renderer: HeaderRendererId; current: string | null }) {
  const { env, file, config } = useHeader()
  const id = useId()
  const isDocument = renderer === 'document'
  const types = isDocument ? allTypes(config) : typesOf(config, renderer)
  const match = types.find((type) => type.toLowerCase() === current?.toLowerCase())
  const options = isDocument || match || current === null ? types : [...types, current]
  return (
    <span className="saga-header-type">
      <label htmlFor={id}>Type</label>
      <MenuSelect
        id={id}
        value={isDocument ? undefined : (match ?? current ?? undefined)}
        {...(isDocument ? { placeholder: 'Set type' } : {})}
        options={options.map((type) => ({ value: type, label: type }))}
        showMenu={env.showMenu}
        onChange={(type) => void setField(env.app, file, config.typeKey, type)}
      />
    </span>
  )
}

/** The bar's banner control: Add banner opens the image picker; with a banner it opens a menu to change, reposition or remove it. The write error is a row of its own under the bar's controls. */
function BannerControl({ banner, label, onReposition }: { banner: Banner; label: string; onReposition: () => void }) {
  const { env } = useHeader()
  const { write, picking, open, trigger, popover, alert } = useBannerPicker(banner.key)
  return (
    <>
      <span className="saga-header-banner-control">
        <button
          ref={trigger}
          type="button"
          className="saga-header-banner-button"
          aria-haspopup={banner.link ? 'menu' : undefined}
          aria-expanded={picking}
          onClick={(event) => {
            if (!banner.link) return open()
            const box = event.currentTarget.getBoundingClientRect()
            env.showMenu({ x: box.left, y: box.bottom }, [
              { title: 'Change banner…', icon: 'image', onClick: open },
              { title: 'Reposition banner', icon: 'move-vertical', onClick: onReposition },
              ...(banner.removable ? [{ title: 'Remove banner', icon: 'trash-2', warning: true, onClick: () => void removeBanner(write, banner.key) }] : [])
            ])
          }}
        >
          <Icon name="image" />
          {banner.link ? label : 'Add banner'}
        </button>
        {popover}
      </span>
      {alert}
    </>
  )
}

/** The header of a note drawn by a renderer: the renderer's label, banner control and type selector, then the layout. */
export function NoteHeader({ env, file, frontmatter, resolution, config, properties, onToggleProperties, onRepositionBanner }: NoteHeaderProps) {
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
          <BannerControl banner={bannerOf(def, keys, frontmatter)} label={renderer === 'map' ? 'Map image' : 'Banner'} onReposition={onRepositionBanner} />
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
