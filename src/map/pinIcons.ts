import type { RendererId } from '../shared/renderers/ids'
import type { PinStyle } from '../shared/schemas/pins'
import { pinColor, pinGlyphId, pinShapeId } from './pinStyles'

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)

export interface PinHtmlOptions {
  /** Id prefix of the sprite the pin draws from. */
  sprite: string
  title: string
  /** Spoken in addition to the title, e.g. "Location, rumour". */
  description: string
  renderer: RendererId
  style: PinStyle
}

const WIDTH = 32
const HEIGHT = 44

const pinSvg = (sprite: string, style: PinStyle, renderer: RendererId): string =>
  `<svg class="saga-map-pin-svg" aria-hidden="true" focusable="false" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" style="--saga-map-pin:${pinColor(renderer)};color:var(--saga-map-pin)">` +
  `<use href="#${pinShapeId(sprite)}"/><use href="#${pinGlyphId(sprite, style)}"/></svg>`

/** The class of a pin button: placed by its bottom tip, selected or not. */
export const pinClass = (selected: boolean): string => `saga-map-placed saga-map-pin${selected ? ' saga-map-pin-selected' : ''}`

/** A pin's content: the head and tip from the sprite in the renderer's colour with the style's glyph, and a visually hidden name for screen readers. */
export function pinHtml({ sprite, title, description, renderer, style }: PinHtmlOptions): string {
  const text = escapeHtml(title)
  return `${pinSvg(sprite, style, renderer)}<span class="saga-map-sr-only">${text} — ${escapeHtml(description)}</span>`
}

/** The content of the pin that follows the cursor or shows where a pin will go. */
export const ghostHtml = (sprite: string, renderer: RendererId, style: PinStyle): string => pinSvg(sprite, style, renderer)

/** Several pins merged at this zoom. */
export const clusterHtml = (count: number): string => `<span aria-hidden="true">${count}</span><span class="saga-map-sr-only">${count} pins here, zoom in to see them</span>`
