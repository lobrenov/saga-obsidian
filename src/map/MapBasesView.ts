import { BasesView, type HoverPopover, type QueryController, type TFile } from 'obsidian'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { PrefsStore } from '../obsidian/prefs'
import type { ConfigStore } from '../obsidian/vault'
import { createHost, type MapHost } from './host'
import { MapRoot } from './MapRoot'
import { mapStateOf } from './mapState'
import { createUi } from './obsidianUi'

export const MAP_VIEW_ID = 'saga-map'

/** The Bases view that draws the pins of the base's notes on the image of the chosen map note. */
export class MapBasesView extends BasesView {
  readonly type = MAP_VIEW_ID
  hoverPopover: HoverPopover | null = null
  private readonly rootEl: HTMLElement
  private readonly root: Root
  private cached: { path: string; host: MapHost } | null = null

  constructor(
    controller: QueryController,
    containerEl: HTMLElement,
    private readonly settings: ConfigStore,
    private readonly prefs: PrefsStore
  ) {
    super(controller)
    containerEl.addClass('saga-map-container')
    this.rootEl = containerEl.createDiv({ cls: 'saga-map-view' })
    this.root = createRoot(this.rootEl)
    this.register(settings.subscribe(() => this.onDataUpdated()))
    this.register(prefs.subscribe(() => this.onDataUpdated()))
  }

  onDataUpdated(): void {
    if (!this.data) return
    const files = (): TFile[] => this.data.data.map((entry) => entry.file)
    const state = mapStateOf(this.app, this.settings, { option: (key) => this.config.get(key), pinLabels: this.prefs.get().pinLabels, files, host: (map) => this.hostFor(map, files) })
    this.root.render(createElement(MapRoot, { state }))
  }

  override onunload(): void {
    this.root.unmount()
    this.rootEl.remove()
  }

  private hostFor(map: TFile, files: () => TFile[]): MapHost {
    if (this.cached?.path !== map.path) this.cached = { path: map.path, host: createHost(this.app, map, createUi(this.app, this, map.path, files)) }
    return this.cached.host
  }
}
