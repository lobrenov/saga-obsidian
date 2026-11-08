import { describe, expect, it } from 'vitest'
import { labelWidth, placeLabels, type LabelTarget } from '../../src/map/labels'

const pin = (key: string, px: number, py: number): LabelTarget => ({ key, title: key, px, py })

describe('placeLabels', () => {
  it('puts a lone pin\'s label to the right', () => {
    expect(placeLabels([pin('a', 100, 100)]).get('a')).toBe('right')
  })

  it('moves a label to the left, then below, when the right is taken by a pin or a label', () => {
    const slots = placeLabels([pin('a', 100, 100), pin('b', 120, 100)])
    expect(slots.get('a')).toBe('left')
    expect(slots.get('b')).toBe('right')
    const three = placeLabels([pin('a', 100, 100), pin('b', 100, 100), pin('c', 100, 100)])
    expect([...three.values()].sort()).toEqual(['below', 'left', 'right'])
  })

  it('hides the label of a pin with no free slot', () => {
    const slots = placeLabels(['a', 'b', 'c', 'd'].map((key) => pin(key, 100, 100)))
    expect([...slots.values()].filter((slot) => slot === null)).toHaveLength(1)
  })

  it('never lets a label cover a pin or another label', () => {
    const targets = Array.from({ length: 30 }, (_, i) => pin(`pin ${i}`, 60 + (i % 6) * 38, 80 + Math.floor(i / 6) * 30))
    const slots = placeLabels(targets)
    const boxes = targets.flatMap((t) => {
      const slot = slots.get(t.key)
      if (!slot) return []
      const w = labelWidth(t.key)
      const top = slot === 'below' ? t.py + 4 : t.py - 36
      const left = slot === 'right' ? t.px + 20 : slot === 'left' ? t.px - 20 - w : t.px - w / 2
      return [{ left, top, right: left + w, bottom: top + 20 }]
    })
    const apart = (a: (typeof boxes)[number], b: (typeof boxes)[number]): boolean => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(apart(a, b)).toBe(true)))
    targets.forEach((t) => boxes.forEach((b) => expect(apart(b, { left: t.px - 16, top: t.py - 43, right: t.px + 16, bottom: t.py + 1 })).toBe(true)))
  })

  it('places the first targets before the rest', () => {
    const targets = [pin('a', 100, 100), pin('b', 100, 100), pin('c', 100, 100), pin('d', 100, 100)]
    expect(placeLabels(targets, new Set(['d'])).get('d')).toBe('right')
  })

  it('keeps a label inside the view', () => {
    const slots = placeLabels([pin('Kholinar', 300, 100)], new Set(), { width: 340, height: 300 })
    expect(slots.get('Kholinar')).toBe('left')
    expect(placeLabels([pin('Kholinar', 20, 100)], new Set(), { width: 100, height: 300 }).get('Kholinar')).toBeNull()
  })

  it('has no label for a cluster and does not let one cover it', () => {
    const slots = placeLabels([{ key: 'c', title: null, px: 100, py: 100 }, pin('a', 125, 100)])
    expect(slots.has('c')).toBe(false)
    expect(slots.get('a')).not.toBe('left')
  })
})
