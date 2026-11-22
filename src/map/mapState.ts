import type { App, TFile } from 'obsidian'
import type { PinLabels } from '../obsidian/prefs'
import { frontmatterOf, resolveLink, resourceUrl, type ConfigStore } from '../obsidian/vault'
import type { MapHost } from './host'
import { collectPins } from './pins'
import type { MapState } from './types'

/** What the Bases view supplies: its option values, the notes of the base, and the Obsidian UI for a map. */
export interface MapViewInput {
  option: (key: string) => unknown
  pinLabels: PinLabels
  /** Obsidian runs on a phone or tablet. */
  mobile: boolean
  files: () => TFile[]
  /** The host of a map; the view keeps it while the map is unchanged. */
  host: (map: TFile) => MapHost
}

/** Whether the note is a map under the current config (its type resolves to the `map` renderer). */
export const isMapNote = (app: App, settings: ConfigStore, file: TFile): boolean => file.extension === 'md' && settings.rendererOf(frontmatterOf(app, file)).renderer === 'map'

/** The image of a map note: its `image` field (under the key the config renames it to) resolved as a link. */
function imageOf(app: App, settings: ConfigStore, map: TFile): TFile | null {
  const key = settings.state().config.renderers.map?.keys['image'] ?? 'image'
  const value = frontmatterOf(app, map)[key]
  return typeof value === 'string' ? resolveLink(app, value, map.path) : null
}

/** What the view shows: the chosen map with the pins of the base's notes on it, or why there is no map. */
export function mapStateOf(app: App, settings: ConfigStore, input: MapViewInput): MapState {
  const path = input.option('map')
  if (typeof path !== 'string' || path === '') return { kind: 'empty', message: 'Choose a map note in the view options.' }
  const map = app.vault.getFileByPath(path) ?? resolveLink(app, path.startsWith('[[') ? path : `[[${path}]]`, '')
  if (!map) return { kind: 'empty', message: `${path} is not in the vault.` }
  if (!isMapNote(app, settings, map)) return { kind: 'empty', message: `${map.basename} is not a map note.` }
  const image = imageOf(app, settings, map)
  if (!image) return { kind: 'empty', message: `${map.basename} has no image, or its image link does not resolve.` }
  const files = input.files()
  return {
    kind: 'map',
    host: input.host(map),
    title: map.basename,
    imageUrl: resourceUrl(app, image),
    pins: collectPins(app, settings, files, map),
    labels: input.pinLabels,
    layers: input.option('layers') !== false,
    mobile: input.mobile
  }
}
