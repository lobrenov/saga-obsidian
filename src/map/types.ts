import type { TFile } from 'obsidian'
import type { PinLabels } from '../obsidian/prefs'
import type { MapHost } from './host'
import type { RendererId } from '../shared/renderers/ids'
import type { PinLook } from '../shared/pins/look'

/** A pin of the chosen map: where one `map-pins` entry of a note sits. */
export interface PlacedPin {
  file: TFile
  /** The note's file name without extension. */
  title: string
  renderer: RendererId
  x: number
  y: number
  /** What the pin shows: its own keys over the renderer's. */
  look: PinLook
  /** The renderer's pin look: what a key removed from the entry falls back to. */
  defaults: PinLook
  /** Position of the entry in the note's `map-pins` list when the base was read. */
  index: number
  issues: string[]
}

export const pinKey = (pin: Pick<PlacedPin, 'file' | 'index'>): string => `${pin.file.path}#${pin.index}`

export type MapState =
  | { kind: 'empty'; message: string }
  | {
      kind: 'map'
      host: MapHost
      title: string
      imageUrl: string
      pins: readonly PlacedPin[]
      labels: PinLabels
      layers: boolean
    }
