import { MarkdownView, type App, type Plugin, type WorkspaceLeaf } from 'obsidian'
import type { ConfigStore } from '../obsidian/vault'
import { createBannerController } from '../banner/controller'
import '../banner/banner.css'
import { createHeaderController, type LeafView } from './controller'
import type { ViewMode } from './dom'
import './header.css'
import { createHeaderEnv, HOVER_SOURCE } from './host'

const modeOf = (view: MarkdownView): ViewMode => (view.getMode() === 'preview' ? 'reading' : view.getState().source === true ? 'source' : 'live')

function markdownViews(app: App): [WorkspaceLeaf, LeafView][] {
  const views: [WorkspaceLeaf, LeafView][] = []
  app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view instanceof MarkdownView) views.push([leaf, { containerEl: leaf.view.containerEl, file: leaf.view.file, mode: modeOf(leaf.view) }])
  })
  return views
}

/** Draws the header of every open note whose `type` maps to a renderer or that has a banner, and the banners, until the plugin unloads. */
export function registerHeader(plugin: Plugin, config: ConfigStore): void {
  const { app } = plugin
  const env = createHeaderEnv(app)
  const banners = createBannerController(env, config)
  const controller = createHeaderController(env, config, (key) => banners.reposition(key))
  let disposed = false
  const sync = (): void => {
    if (disposed) return
    const views = markdownViews(app)
    controller.sync(views)
    banners.sync(views)
  }

  plugin.registerHoverLinkSource(HOVER_SOURCE, { display: 'Saga header', defaultMod: true })
  plugin.registerEvent(app.workspace.on('file-open', sync))
  plugin.registerEvent(app.workspace.on('layout-change', sync))
  plugin.registerEvent(app.workspace.on('active-leaf-change', sync))
  plugin.registerEvent(app.metadataCache.on('changed', sync))
  plugin.registerEvent(app.vault.on('rename', sync))
  plugin.registerEvent(app.vault.on('create', sync))
  plugin.registerEvent(app.vault.on('delete', sync))
  plugin.register(config.subscribe(sync))
  plugin.register(() => {
    disposed = true
    controller.dispose()
    banners.dispose()
  })
  app.workspace.onLayoutReady(sync)
}
