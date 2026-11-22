import type { PinShape, ShapeId } from '../shared/pins/look'
import { shapeDef } from './pinStyles'

export type LabelSlot = 'right' | 'left' | 'below'

/** A pin or cluster at a screen point that a label may be placed for. */
export interface LabelTarget {
  key: string
  /** The pin's label text; null for a cluster, which has none. */
  title: string | null
  /** The pin's shape (a pin when absent); a cluster has none. */
  shape?: ShapeId | undefined
  px: number
  py: number
}

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

const CLUSTER_HALF = 20
const LABEL_HEIGHT = 20
const GAP = 4
const MARGIN = 2
const CHAR_PX = 7
const PADDING_PX = 18

/** The screen box of the label text (an estimate from its length). */
export const labelWidth = (title: string): number => Math.ceil(title.length * CHAR_PX + PADDING_PX)

const pinBox = (t: LabelTarget): Box => {
  if (t.title === null) return { left: t.px - CLUSTER_HALF, top: t.py - CLUSTER_HALF, right: t.px + CLUSTER_HALF, bottom: t.py + CLUSTER_HALF }
  const shape = shapeDef(t.shape ?? 'pin')
  return { left: t.px - shape.ax, top: t.py - shape.ay, right: t.px - shape.ax + shape.w, bottom: t.py - shape.ay + shape.h }
}

/** Where a label sits from its pin's image point: `top` with `left` (right slot) or `right` (left slot) clear of the shape's box and level with its icon; below is centred on the point. */
export function labelOffset(shape: PinShape, slot: LabelSlot): { top: number; left?: number; right?: number } {
  if (slot === 'below') return { top: shape.h - shape.ay + GAP, left: 0 }
  const top = shape.iy + shape.is / 2 - shape.ay - LABEL_HEIGHT / 2
  return slot === 'right' ? { top, left: shape.w - shape.ax + GAP } : { top, right: shape.ax + GAP }
}

/** The label's box in each slot: beside the shape (right, left) or under the anchor. */
function slotBox(t: LabelTarget, slot: LabelSlot, width: number): Box {
  const offset = labelOffset(shapeDef(t.shape ?? 'pin'), slot)
  const top = t.py + offset.top
  if (slot === 'below') return { left: t.px - width / 2, top, right: t.px + width / 2, bottom: top + LABEL_HEIGHT }
  const left = slot === 'right' ? t.px + (offset.left ?? 0) : t.px - (offset.right ?? 0) - width
  return { left, top, right: left + width, bottom: top + LABEL_HEIGHT }
}

const hits = (a: Box, b: Box): boolean => a.left < b.right + MARGIN && a.right > b.left - MARGIN && a.top < b.bottom + MARGIN && a.bottom > b.top - MARGIN

const SLOTS: readonly LabelSlot[] = ['right', 'left', 'below']

/**
 * Places each pin's label in the first of right, left and below where it covers no pin, cluster or earlier label and, given `view`, lies
 * inside the view; null when no slot is free. Targets are placed in order of position (top to bottom, then left to right).
 */
export function placeLabels(targets: readonly LabelTarget[], view?: { width: number; height: number }): Map<string, LabelSlot | null> {
  const obstacles = targets.map(pinBox)
  const placed: Box[] = []
  const slots = new Map<string, LabelSlot | null>()
  const order = targets.filter((t) => t.title !== null).sort((a, b) => a.py - b.py || a.px - b.px || (a.key < b.key ? -1 : 1))
  for (const target of order) {
    const width = labelWidth(target.title ?? '')
    const slot = SLOTS.find((candidate) => {
      const box = slotBox(target, candidate, width)
      const inside = !view || (box.left >= 0 && box.top >= 0 && box.right <= view.width && box.bottom <= view.height)
      return inside && !obstacles.some((o) => hits(box, o)) && !placed.some((p) => hits(box, p))
    })
    if (slot) placed.push(slotBox(target, slot, width))
    slots.set(target.key, slot ?? null)
  }
  return slots
}
