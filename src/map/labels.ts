export type LabelSlot = 'right' | 'left' | 'below'

/** A pin or cluster at a screen point that a label may be placed for. */
export interface LabelTarget {
  key: string
  /** The pin's label text; null for a cluster, which has none. */
  title: string | null
  px: number
  py: number
}

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

const PIN_HALF = 16
const PIN_HEIGHT = 43
const CLUSTER_HALF = 20
const LABEL_HEIGHT = 20
const GAP = 4
const MARGIN = 2
const CHAR_PX = 7
const PADDING_PX = 18

/** The screen box of the label text (an estimate from its length). */
export const labelWidth = (title: string): number => Math.ceil(title.length * CHAR_PX + PADDING_PX)

const pinBox = (t: LabelTarget): Box =>
  t.title === null ? { left: t.px - CLUSTER_HALF, top: t.py - CLUSTER_HALF, right: t.px + CLUSTER_HALF, bottom: t.py + CLUSTER_HALF } : { left: t.px - PIN_HALF, top: t.py - PIN_HEIGHT, right: t.px + PIN_HALF, bottom: t.py + 1 }

/** The label's box in each slot: beside the head (right, left) or under the tip. */
function slotBox(t: LabelTarget, slot: LabelSlot, width: number): Box {
  if (slot === 'below') return { left: t.px - width / 2, top: t.py + GAP, right: t.px + width / 2, bottom: t.py + GAP + LABEL_HEIGHT }
  const top = t.py - PIN_HEIGHT + 7
  return slot === 'right'
    ? { left: t.px + PIN_HALF + GAP, top, right: t.px + PIN_HALF + GAP + width, bottom: top + LABEL_HEIGHT }
    : { left: t.px - PIN_HALF - GAP - width, top, right: t.px - PIN_HALF - GAP, bottom: top + LABEL_HEIGHT }
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
