import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { TFile } from 'obsidian'
import { frontmatterOf, type ConfigStore } from '../obsidian/vault'
import { bannerOf } from '../shared/renderers/banner'
import { rendererDefs } from '../shared/renderers/definitions'
import { isolatePointer, markActive, placeHost, watchPlacement, type ViewMode } from './dom'
import type { HeaderEnv } from './env'
import { NoteHeader, type NoteHeaderProps } from './NoteHeader'

/** What the controller needs of a Markdown view. */
export interface LeafView {
  containerEl: HTMLElement
  file: TFile | null
  mode: ViewMode
}

type Drawn = Omit<NoteHeaderProps, 'properties' | 'onToggleProperties' | 'onRepositionBanner'>

interface Mount {
  containerEl: HTMLElement
  mode: 'live' | 'reading'
  host: HTMLElement
  root: Root
  stopWatching: () => void
  /** The Properties toggle: the native properties show below the header. */
  properties: boolean
  drawn: Drawn
  /** What the root was last given; an unchanged draw is skipped. */
  signature: string
}

export interface HeaderController {
  /** Brings the headers in line with the views: mounts, updates and unmounts. */
  sync(views: Iterable<[key: object, view: LeafView]>): void
  dispose(): void
}

const NO_KEYS: Readonly<Record<string, string>> = {}

/** One React root per leaf whose note has a renderer, or is a `document` note while `documentCard()` is on or it has a banner, in Live Preview and Reading view; `repositionBanner(key)` puts the leaf's banner into reposition mode. */
export function createHeaderController(env: HeaderEnv, config: ConfigStore, repositionBanner: (key: object) => void, documentCard: () => boolean): HeaderController {
  const mounts = new Map<object, Mount>()

  const place = (mount: Mount): void => markActive(mount.containerEl, placeHost(mount.containerEl, mount.host, mount.mode), mount.properties)

  const draw = (key: object, mount: Mount): void => {
    const signature = JSON.stringify([mount.drawn.file.path, mount.drawn.frontmatter, mount.drawn.resolution, config.state().text, mount.properties])
    if (signature === mount.signature) return
    mount.signature = signature
    mount.root.render(
      createElement(NoteHeader, {
        key: mount.drawn.file.path,
        ...mount.drawn,
        properties: mount.properties,
        onToggleProperties: () => {
          mount.properties = !mount.properties
          place(mount)
          draw(key, mount)
        },
        onRepositionBanner: () => repositionBanner(key)
      })
    )
  }

  const unmount = (key: object): void => {
    const mount = mounts.get(key)
    if (!mount) return
    mounts.delete(key)
    mount.stopWatching()
    mount.root.unmount()
    mount.host.remove()
    markActive(mount.containerEl, false)
  }

  const mountFor = (key: object, containerEl: HTMLElement, mode: 'live' | 'reading', drawn: Drawn): Mount => {
    const existing = mounts.get(key)
    if (existing && existing.containerEl === containerEl && existing.mode === mode) return existing
    unmount(key)
    const host = containerEl.ownerDocument.createElement('div')
    host.className = 'saga-header-host'
    isolatePointer(host)
    const mount: Mount = { containerEl, mode, host, root: createRoot(host), stopWatching: () => undefined, properties: existing?.properties ?? false, drawn, signature: '' }
    // The view re-creates its sizer on some mode and file changes; the host is placed again when it goes missing.
    mount.stopWatching = watchPlacement(containerEl, mode, () => place(mount))
    mounts.set(key, mount)
    return mount
  }

  return {
    sync(views) {
      const live = new Set<object>()
      for (const [key, { containerEl, file, mode }] of views) {
        if (!file || mode === 'source') continue
        const frontmatter = frontmatterOf(env.app, file)
        const resolution = config.rendererOf(frontmatter)
        const { renderer } = resolution
        const keys = config.state().config.renderers[renderer]?.keys ?? NO_KEYS
        if (renderer === 'document' && !documentCard() && !bannerOf(rendererDefs.document, keys, frontmatter).link) continue
        live.add(key)
        const drawn: Drawn = { env, file, frontmatter, resolution, config: config.state().config }
        const mount = mountFor(key, containerEl, mode, drawn)
        mount.drawn = drawn
        place(mount)
        draw(key, mount)
      }
      for (const key of [...mounts.keys()]) if (!live.has(key)) unmount(key)
    },
    dispose() {
      for (const key of [...mounts.keys()]) unmount(key)
    }
  }
}
