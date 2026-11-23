import type { App, TFile } from 'obsidian'
import { HeaderCtx, type HeaderEnv } from '../header/env'
import { Icon } from '../header/Icon'
import { LayoutBoundary } from '../header/LayoutBoundary'
import { rendererRegistry } from '../header/registry'
import { resolveLink, resourceUrl } from '../obsidian/vault'
import { bannerOf } from '../shared/renderers/banner'
import type { RendererDef } from '../shared/renderers/define'
import { rendererDefs } from '../shared/renderers/definitions'
import { createRendererResolver } from '../shared/renderers/resolve'
import type { Config } from '../shared/schemas/config'

export interface PrintNoteProps {
  app: App
  setIcon: HeaderEnv['setIcon']
  file: TFile
  frontmatter: Readonly<Record<string, unknown>>
  config: Config
  /** The `documentCard` pref: a `document` note prints a card while it is on or the note has a banner. */
  documentCard: boolean
}

const NO_KEYS: Readonly<Record<string, string>> = {}
const NO_HIDDEN: readonly string[] = []

const refuse = (name: string) => () => {
  throw new Error(`${name} is not available in print`)
}

/** The note's banner and header card as static, read-only content; the `<img>` elements fire `load` or `error` once settled. */
export function PrintNote({ app, setIcon, file, frontmatter, config, documentCard }: PrintNoteProps) {
  const { renderer } = createRendererResolver(config)(frontmatter)
  const def: RendererDef = rendererDefs[renderer]
  const keys = config.renderers[renderer]?.keys ?? NO_KEYS
  const banner = bannerOf(def, keys, frontmatter)
  const image = banner.link ? resolveLink(app, banner.link, file.path) : null
  const classes: unknown = frontmatter['cssclasses']
  const tall = (Array.isArray(classes) ? classes : typeof classes === 'string' ? classes.split(/[\s,]+/) : []).includes('banner-tall')
  const card = renderer !== 'document' || documentCard || banner.link !== null
  const { PrintLayout } = rendererRegistry[renderer]
  const env: HeaderEnv = { app, setIcon, openLink: refuse('openLink'), hover: refuse('hover'), showMenu: refuse('showMenu'), suggest: refuse('suggest') }
  const title = <h1 className="saga-header-title">{file.basename}</h1>

  return (
    <HeaderCtx.Provider value={{ env, file, config, renderer }}>
      <div className="saga-print" data-banner-tall={tall || undefined}>
        {image ? (
          <div className="saga-banner">
            <div className="saga-banner-image">
              <img src={resourceUrl(app, image)} alt="" data-path={image.path} data-y={banner.y} style={{ objectPosition: `50% ${banner.y}%` }} />
            </div>
          </div>
        ) : null}
        {card ? (
          <section className="saga-header" data-renderer={renderer}>
            <div className="saga-header-bar">
              <span className="saga-header-badge">
                <Icon name={def.icon} />
                {def.label}
              </span>
            </div>
            <div className="saga-header-body">
              <LayoutBoundary resetKey={`${file.path}:${renderer}`} fallback={title}>
                <PrintLayout title={title} frontmatter={frontmatter} keys={keys} hidden={config.renderers[renderer]?.hidden ?? NO_HIDDEN} />
              </LayoutBoundary>
            </div>
          </section>
        ) : null}
      </div>
    </HeaderCtx.Provider>
  )
}
