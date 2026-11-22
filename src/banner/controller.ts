import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { TFile } from 'obsidian'
import type { LeafView } from '../header/controller'
import { isolatePointer, watchPlacement } from '../header/dom'
import { HeaderCtx, type HeaderEnv } from '../header/env'
import { frontmatterOf, resolveLink, type ConfigStore } from '../obsidian/vault'
import { bannerOf, type Banner as BannerData } from '../shared/renderers/banner'
import { rendererDefs } from '../shared/renderers/definitions'
import type { RendererId } from '../shared/renderers/ids'
import { AddBanner } from './AddBanner'
import { Banner } from './Banner'
import { markBanner, placeAdd, placeBanner, watchScroll } from './dom'

type Kind = 'banner' | 'add'

interface Drawn {
  file: TFile
  renderer: RendererId
  banner: BannerData
  image: TFile | null
}

interface Mount {
  containerEl: HTMLElement
  mode: 'live' | 'reading'
  kind: Kind
  host: HTMLElement
  root: Root
  stopWatching: () => void
  stopScroll: () => void
  /** The banner is in reposition mode. */
  repositioning: boolean
  drawn: Drawn
  /** What the root was last given; an unchanged draw is skipped. */
  signature: string
}

export interface BannerController {
  /** Brings the banners in line with the views: mounts, updates and unmounts. */
  sync(views: Iterable<[key: object, view: LeafView]>): void
  /** Puts the banner of the leaf into reposition mode. */
  reposition(key: object): void
  dispose(): void
}

const NO_KEYS: Readonly<Record<string, string>> = {}

/** One React root per leaf whose note has a banner, or is a `document` note without one (the Add button), in Live Preview and Reading view. */
export function createBannerController(env: HeaderEnv, config: ConfigStore, documentCard: () => boolean): BannerController {
  const mounts = new Map<object, Mount>()

  const place = (mount: Mount): void => {
    const placed = mount.kind === 'banner' ? placeBanner(mount.containerEl, mount.host, mount.mode) : placeAdd(mount.containerEl, mount.host, mount.mode)
    markBanner(mount.containerEl, mount.kind === 'banner' && placed)
  }

  const draw = (mount: Mount): void => {
    const { file, renderer, banner, image } = mount.drawn
    const signature = JSON.stringify([file.path, mount.kind, renderer, banner, image?.path, config.state().text, mount.repositioning])
    if (signature === mount.signature) return
    mount.signature = signature
    const content =
      mount.kind === 'add'
        ? createElement(AddBanner)
        : createElement(Banner, {
            banner,
            image,
            repositioning: mount.repositioning,
            onRepositioningChange: (on: boolean) => {
              mount.repositioning = on
              draw(mount)
            }
          })
    mount.root.render(createElement(HeaderCtx.Provider, { key: file.path, value: { env, file, config: config.state().config, renderer } }, content))
  }

  const unmount = (key: object): void => {
    const mount = mounts.get(key)
    if (!mount) return
    mounts.delete(key)
    mount.stopWatching()
    mount.stopScroll()
    mount.root.unmount()
    mount.host.remove()
    markBanner(mount.containerEl, false)
  }

  const mountFor = (key: object, containerEl: HTMLElement, mode: 'live' | 'reading', kind: Kind, drawn: Drawn): Mount => {
    const existing = mounts.get(key)
    if (existing && existing.containerEl === containerEl && existing.mode === mode && existing.kind === kind) return existing
    unmount(key)
    const host = containerEl.ownerDocument.createElement('div')
    host.className = kind === 'banner' ? 'saga-banner-host' : 'saga-banner-add-host'
    isolatePointer(host)
    const mount: Mount = { containerEl, mode, kind, host, root: createRoot(host), stopWatching: () => undefined, stopScroll: () => undefined, repositioning: false, drawn, signature: '' }
    // The view re-creates its sizer on some mode and file changes; the host is placed again when it goes missing.
    mount.stopWatching = watchPlacement(containerEl, mode, () => place(mount))
    if (kind === 'banner') mount.stopScroll = watchScroll(containerEl, host)
    mounts.set(key, mount)
    return mount
  }

  return {
    sync(views) {
      const live = new Set<object>()
      for (const [key, { containerEl, file, mode }] of views) {
        if (!file || mode === 'source') continue
        const frontmatter = frontmatterOf(env.app, file)
        const { renderer } = config.rendererOf(frontmatter)
        const banner = bannerOf(rendererDefs[renderer], config.state().config.renderers[renderer]?.keys ?? NO_KEYS, frontmatter)
        const kind: Kind | null = banner.link ? 'banner' : renderer === 'document' && !documentCard() ? 'add' : null
        if (!kind) continue
        live.add(key)
        const drawn: Drawn = { file, renderer, banner, image: banner.link ? resolveLink(env.app, banner.link, file.path) : null }
        const mount = mountFor(key, containerEl, mode, kind, drawn)
        if (mount.drawn.file.path !== file.path) mount.repositioning = false
        mount.drawn = drawn
        place(mount)
        draw(mount)
      }
      for (const key of [...mounts.keys()]) if (!live.has(key)) unmount(key)
    },
    reposition(key) {
      const mount = mounts.get(key)
      if (mount?.kind !== 'banner') return
      mount.repositioning = true
      draw(mount)
    },
    dispose() {
      for (const key of [...mounts.keys()]) unmount(key)
    }
  }
}
