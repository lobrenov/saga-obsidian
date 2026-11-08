import { createContext } from 'react'
import { PIN_STYLES } from '../shared/schemas/pins'
import { PIN_PATH, STYLE_GLYPHS, pinGlyphId, pinShapeId } from './pinStyles'

/** The id prefix of the sprite in the current map view; each view has its own so views in other panes do not share symbols. */
export const SpriteContext = createContext('saga-map-sprite')

/** The pin shapes every marker draws with `<use>`: the outline (in the marker's colour) and one head glyph per style. */
export function PinSprite({ id }: { id: string }) {
  const glyphs = PIN_STYLES.map((style) => `<symbol id="${pinGlyphId(id, style)}" viewBox="0 0 32 44" style="fill:var(--background-primary)">${STYLE_GLYPHS[style]}</symbol>`).join('')
  const shape = `<symbol id="${pinShapeId(id)}" viewBox="0 0 32 44"><path d="${PIN_PATH}" style="fill:currentColor;stroke:var(--background-primary);stroke-width:2"/></symbol>`
  return <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: 'absolute' }} dangerouslySetInnerHTML={{ __html: shape + glyphs }} />
}
