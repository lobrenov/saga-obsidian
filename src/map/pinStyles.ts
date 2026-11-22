import type { CSSProperties } from 'react'
import { PIN_ICONS, SHAPES, type ColorId, type PinShape, type ShapeId } from '../shared/pins/look'

/** The light colour of a pin's outline. */
export const PIN_LIGHT = '#fbf8f2'

/** Colour of a pin: the CSS variable of its colour name. */
export const pinColor = (color: ColorId): string => `var(--saga-pin-${color})`

const SHAPE_BY_ID = Object.fromEntries(SHAPES.map((shape) => [shape.id, shape])) as Record<ShapeId, PinShape>
export const shapeDef = (id: ShapeId): PinShape => SHAPE_BY_ID[id]

/** The catalogue label of an icon id (the id itself when it is not in the catalogue). */
export const iconLabel = (id: string): string => PIN_ICONS.find((icon) => icon.id === id)?.label ?? id

export const pinShapeId = (sprite: string, shape: ShapeId): string => `${sprite}-shape-${shape}`
export const pinGlyphId = (sprite: string, icon: string): string => `${sprite}-glyph-${icon}`

/** The box of a shape on its anchor: the element's origin is the pin's screen point. */
export const anchoredBox = (shape: PinShape): CSSProperties => ({ left: -shape.ax, top: -shape.ay, width: shape.w, height: shape.h })
