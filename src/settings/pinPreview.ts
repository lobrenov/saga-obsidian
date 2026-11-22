import { getIcon } from 'obsidian'
import { FALLBACK_ICON, type PinLook } from '../shared/pins/look'
import { PIN_LIGHT, pinColor, shapeDef } from '../map/pinStyles'

/** Draws a pin of `look` into `el` as the map does: the outlined shape in the colour, the icon's glyph in the shape's icon box. */
export function drawPinPreview(el: HTMLElement, look: PinLook): void {
  const shape = shapeDef(look.shape)
  const glyph = (getIcon(look.icon) ?? getIcon(FALLBACK_ICON))?.innerHTML ?? ''
  el.innerHTML =
    `<svg viewBox="0 0 ${shape.w} ${shape.h}"><path d="${shape.d}" fill="${pinColor(look.color)}" stroke="${PIN_LIGHT}" stroke-width="2" stroke-linejoin="round"/>` +
    `<svg x="${shape.ix}" y="${shape.iy}" width="${shape.is}" height="${shape.is}" viewBox="0 0 24 24">${glyph}</svg></svg>`
}
