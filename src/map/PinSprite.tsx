import { createContext } from 'react'
import { getIcon } from 'obsidian'
import { FALLBACK_ICON, SHAPES } from '../shared/pins/look'
import { PIN_LIGHT, pinGlyphId, pinShapeId } from './pinStyles'

/** The id prefix of the sprite in the current map view; each view has its own so views in other panes do not share symbols. */
export const SpriteContext = createContext('saga-map-sprite')

/** The symbols every marker draws with `<use>`: one outline per shape (in the marker's colour) and one glyph per icon in use, from Obsidian's icons (the fallback icon for an id it does not know). */
export function PinSprite({ id, icons }: { id: string; icons: readonly string[] }) {
  const shapes = SHAPES.map((shape) => `<symbol id="${pinShapeId(id, shape.id)}" viewBox="0 0 ${shape.w} ${shape.h}"><path d="${shape.d}" fill="currentColor" stroke="${PIN_LIGHT}" stroke-width="2" stroke-linejoin="round"/></symbol>`).join('')
  const glyphs = icons.map((icon) => `<symbol id="${pinGlyphId(id, icon)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${(getIcon(icon) ?? getIcon(FALLBACK_ICON))?.innerHTML ?? ''}</symbol>`).join('')
  return <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: 'absolute' }} dangerouslySetInnerHTML={{ __html: shapes + glyphs }} />
}
