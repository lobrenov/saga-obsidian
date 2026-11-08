import type { TFile } from 'obsidian'
import type { MapHost } from './host'
import type { RendererId } from '../shared/renderers/ids'
import type { PinStyle } from '../shared/schemas/pins'

/** A pin of the chosen map: where one `map-pins` entry of a note sits. */
export interface PlacedPin {
  file: TFile
  /** The note's file name without extension. */
  title: string
  renderer: RendererId
  x: number
  y: number
  style: PinStyle
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
      labels: boolean
      layers: boolean
    }
