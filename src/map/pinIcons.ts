import type { PinLook } from '../shared/pins/look'
import { pinColor, pinGlyphId, pinShapeId, shapeDef } from './pinStyles'

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)

export interface PinHtmlOptions {
  /** Id prefix of the sprite the pin draws from. */
  sprite: string
  title: string
  /** Spoken in addition to the title, e.g. "Location, Castle". */
  description: string
  look: PinLook
}

const pinSvg = (sprite: string, look: PinLook): string => {
  const shape = shapeDef(look.shape)
  return (
    `<svg class="saga-map-pin-svg" aria-hidden="true" focusable="false" width="${shape.w}" height="${shape.h}" viewBox="0 0 ${shape.w} ${shape.h}" style="--saga-map-pin:${pinColor(look.color)};color:var(--saga-map-pin)">` +
    `<use href="#${pinShapeId(sprite, shape.id)}"/><use href="#${pinGlyphId(sprite, look.icon)}" x="${shape.ix}" y="${shape.iy}" width="${shape.is}" height="${shape.is}" style="color:var(--saga-map-pin-glyph)"/></svg>`
  )
}

/** The class of a pin button: placed by its shape's anchor. */
export const pinClass = 'saga-map-placed saga-map-pin'

/** A pin's content: its shape in its colour with the icon's glyph, and a visually hidden name for screen readers. */
export function pinHtml({ sprite, title, description, look }: PinHtmlOptions): string {
  const text = escapeHtml(title)
  return `${pinSvg(sprite, look)}<span class="saga-map-sr-only">${text} — ${escapeHtml(description)}</span>`
}

/** The content of the pin that follows the cursor or shows where a pin will go. */
export const ghostHtml = (sprite: string, look: PinLook): string => pinSvg(sprite, look)

/** Several pins merged at this zoom. */
export const clusterHtml = (count: number): string => `<span aria-hidden="true">${count}</span><span class="saga-map-sr-only">${count} pins here, zoom in to see them</span>`
