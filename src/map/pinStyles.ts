import type { RendererId } from '../shared/renderers/ids'
import type { PinStyle } from '../shared/schemas/pins'

export const STYLE_LABELS: Record<PinStyle, string> = {
  auto: 'Auto',
  rumour: 'Rumour',
  danger: 'Danger',
  treasure: 'Treasure',
  quest: 'Quest',
  camp: 'Camp'
}

/** Pin outline on a 32x44 grid. */
export const PIN_PATH = 'M16 43c-1.5-4-14-15-14-27a14 14 0 0 1 28 0c0 12-12.5 23-14 27z'

/** Inner shape of a pin's head on the 32x44 grid, centred on (16, 16); the plain dot is the default. Fill comes from the symbol's `fill`. */
export const STYLE_GLYPHS: Record<PinStyle, string> = {
  auto: '<circle cx="16" cy="16" r="5"/>',
  rumour: '<circle cx="16" cy="16" r="5.5" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  danger: '<path d="M16 10.5 22 21H10z"/>',
  treasure: '<path d="M16 9.5 22.5 16 16 22.5 9.5 16z"/>',
  quest: '<path d="m16 9.5 1.9 4.1 4.4.5-3.3 3 .9 4.4-3.9-2.2-3.9 2.2.9-4.4-3.3-3 4.4-.5z"/>',
  camp: '<rect x="11" y="11" width="10" height="10" rx="1.5"/>'
}

/** Colour of a pin: the style's colour, or for `auto` the colour of the note's renderer (variables defined on `.saga-map`). */
export const pinColor = (style: PinStyle, renderer: RendererId): string => (style === 'auto' ? `var(--saga-map-renderer-${renderer})` : `var(--saga-map-pin-${style})`)

export const pinShapeId = (sprite: string): string => `${sprite}-shape`
export const pinGlyphId = (sprite: string, style: PinStyle): string => `${sprite}-glyph-${style}`
