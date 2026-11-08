import type { Plugin } from 'obsidian'
import type { PrefsStore } from '../obsidian/prefs'
import type { ConfigStore } from '../obsidian/vault'
import './map.css'
import { MAP_VIEW_ID, MapBasesView } from './MapBasesView'
import { isMapNote } from './mapState'
import { HOVER_SOURCE } from './obsidianUi'

/** Registers the Saga map Bases view and its hover-preview source. */
export function registerMapView(plugin: Plugin, config: ConfigStore, prefs: PrefsStore): void {
  plugin.registerHoverLinkSource(HOVER_SOURCE, { display: 'Saga map', defaultMod: true })
  plugin.registerBasesView(MAP_VIEW_ID, {
    name: 'Saga map',
    icon: 'map',
    factory: (controller, containerEl) => new MapBasesView(controller, containerEl, config, prefs),
    options: () => [
      { type: 'file', key: 'map', displayName: 'Map note', placeholder: 'A note of type map', filter: (file) => isMapNote(plugin.app, config, file) },
      { type: 'toggle', key: 'layers', displayName: 'Layers panel', default: true }
    ]
  })
}
