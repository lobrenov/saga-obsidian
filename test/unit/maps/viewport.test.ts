import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  clamp,
  fit,
  imageZoomLimits,
  panBy,
  pinch,
  toImage,
  toScreen,
  visibleRect,
  zoomAt
} from '../../../src/shared/maps/viewport'

const view = { width: 800, height: 600 }
const wide = { min: -100, max: 100 }
const num = (min: number, max: number) => fc.double({ min, max, noNaN: true })
const viewport = fc.record({
  zoom: num(-8, 4),
  cx: num(-1e4, 1e4),
  cy: num(-1e4, 1e4)
})

describe('zoomAt', () => {
  it('keeps the image point under the cursor fixed', () => {
    fc.assert(
      fc.property(viewport, num(0, 800), num(0, 600), num(-3, 3), (v, sx, sy, dz) => {
        const before = toImage(v, view, sx, sy)
        const after = toImage(zoomAt(v, view, sx, sy, dz, wide), view, sx, sy)
        const tol = 1e-6 * Math.max(1, Math.abs(before.x), Math.abs(before.y))
        expect(Math.abs(after.x - before.x)).toBeLessThan(tol)
        expect(Math.abs(after.y - before.y)).toBeLessThan(tol)
      })
    )
  })
})

describe('zoomAt limits', () => {
  const limits = { min: -2, max: 3 }

  it('leaves the centre alone at a limit', () => {
    const atMax = { zoom: 3, cx: 100, cy: 200 }
    expect(zoomAt(atMax, view, 800, 600, 0.1, limits)).toEqual(atMax)
    const atMin = { zoom: -2, cx: 100, cy: 200 }
    expect(zoomAt(atMin, view, 0, 0, -0.1, limits)).toEqual(atMin)
  })

  it('stops at the limit', () => {
    expect(zoomAt({ zoom: 2.95, cx: 0, cy: 0 }, view, 10, 10, 1, limits).zoom).toBe(3)
  })
})

describe('toScreen and toImage', () => {
  it('round-trip', () => {
    fc.assert(
      fc.property(viewport, num(-1e4, 1e4), num(-1e4, 1e4), (v, x, y) => {
        const back = toImage(v, view, toScreen(v, view, x, y).x, toScreen(v, view, x, y).y)
        expect(back.x).toBeCloseTo(x, 4)
        expect(back.y).toBeCloseTo(y, 4)
      })
    )
  })
})

describe('fit, panBy and visibleRect', () => {
  const image = { width: 1600, height: 600 }

  it('fits the whole image, centred', () => {
    const v = fit(image, view)
    expect(v).toEqual({ zoom: -1, cx: 800, cy: 300 })
    const r = visibleRect(v, view)
    expect(r.left).toBeCloseTo(0)
    expect(r.right).toBeCloseTo(1600)
    expect(r.top).toBeCloseTo(-300)
    expect(r.bottom).toBeCloseTo(900)
  })

  it('returns a finite zoom for a zero view or image', () => {
    expect(fit(image, { width: 0, height: 0 })).toEqual({ zoom: 0, cx: 800, cy: 300 })
    expect(fit({ width: 0, height: 0 }, view)).toEqual({ zoom: 0, cx: 0, cy: 0 })
  })

  it('pans by screen pixels', () => {
    const v = panBy({ zoom: 1, cx: 100, cy: 100 }, 20, -10)
    expect(v).toEqual({ zoom: 1, cx: 90, cy: 105 })
  })
})

describe('zoom limits', () => {
  it('lets a single image out to about 64 px and in to 8x', () => {
    expect(imageZoomLimits({ width: 4000, height: 1000 })).toEqual({
      min: -6,
      max: 3
    })
    expect(imageZoomLimits({ width: 100, height: 50 })).toEqual({
      min: -1,
      max: 3
    })
  })
})

describe('clamp', () => {
  const image = { width: 1000, height: 1000 }
  const limits = { min: -4, max: 3 }

  it('clamps the zoom to the limits', () => {
    expect(clamp({ zoom: 9, cx: 500, cy: 500 }, image, view, limits).zoom).toBe(3)
    expect(clamp({ zoom: -9, cx: 500, cy: 500 }, image, view, limits).zoom).toBe(-4)
  })

  it('leaves a centred view alone', () => {
    const v = { zoom: 0, cx: 500, cy: 500 }
    expect(clamp(v, image, view, limits)).toEqual(v)
  })

  it('keeps a quarter of the view on the image', () => {
    const left = clamp({ zoom: 0, cx: 1e6, cy: 500 }, image, view, limits)
    expect(toScreen(left, view, 1000, 0).x).toBeCloseTo(view.width / 4)
    const top = clamp({ zoom: 0, cx: 500, cy: -1e6 }, image, view, limits)
    expect(toScreen(top, view, 0, 0).y).toBeCloseTo(view.height * 0.75)
  })

  it('is idempotent and always leaves enough of the image in view', () => {
    fc.assert(
      fc.property(viewport, fc.integer({ min: 1, max: 20000 }), fc.integer({ min: 1, max: 20000 }), (v, width, height) => {
        const img = { width, height }
        const c = clamp(v, img, view, limits)
        expect(clamp(c, img, view, limits)).toEqual(c)
        const s = 2 ** c.zoom
        const a = toScreen(c, view, 0, 0)
        const b = toScreen(c, view, width, height)
        const shownX = Math.min(view.width, b.x) - Math.max(0, a.x)
        const shownY = Math.min(view.height, b.y) - Math.max(0, a.y)
        expect(shownX).toBeGreaterThanOrEqual(Math.min(view.width / 4, width * s) - 1e-6)
        expect(shownY).toBeGreaterThanOrEqual(Math.min(view.height / 4, height * s) - 1e-6)
      })
    )
  })
})

describe('pinch', () => {
  const v = { zoom: 0, cx: 500, cy: 400 }

  it('zooms one level when the fingers spread to twice their distance, keeping the image point under their midpoint', () => {
    const after = pinch(v, view, [{ x: 350, y: 300 }, { x: 450, y: 300 }], [{ x: 300, y: 300 }, { x: 500, y: 300 }], wide)
    expect(after.zoom).toBeCloseTo(1)
    expect(toImage(after, view, 400, 300).x).toBeCloseTo(toImage(v, view, 400, 300).x)
    expect(toImage(after, view, 400, 300).y).toBeCloseTo(toImage(v, view, 400, 300).y)
  })

  it('pans with the midpoint when the spread is unchanged', () => {
    const after = pinch(v, view, [{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 130, y: 110 }, { x: 230, y: 110 }], wide)
    expect(after).toEqual(panBy(v, 30, 10))
  })

  it('keeps the image point under the starting midpoint under the moved midpoint', () => {
    fc.assert(
      fc.property(viewport, num(0, 800), num(0, 600), num(0, 800), num(0, 600), num(1, 400), num(1, 400), (start, ax, ay, bx, by, d0, d1) => {
        const after = pinch(start, view, [{ x: ax - d0, y: ay }, { x: ax + d0, y: ay }], [{ x: bx, y: by - d1 }, { x: bx, y: by + d1 }], wide)
        const before = toImage(start, view, ax, ay)
        const moved = toImage(after, view, bx, by)
        const tol = 1e-6 * Math.max(1, Math.abs(before.x), Math.abs(before.y))
        expect(after.zoom).toBeCloseTo(start.zoom + Math.log2(d1 / d0))
        expect(Math.abs(moved.x - before.x)).toBeLessThan(tol)
        expect(Math.abs(moved.y - before.y)).toBeLessThan(tol)
      })
    )
  })

  it('stays within the zoom limits', () => {
    const after = pinch(v, view, [{ x: 399, y: 300 }, { x: 401, y: 300 }], [{ x: 0, y: 300 }, { x: 800, y: 300 }], { min: -2, max: 3 })
    expect(after.zoom).toBe(3)
  })

  it('does not zoom when the fingers start at one point', () => {
    expect(pinch(v, view, [{ x: 400, y: 300 }, { x: 400, y: 300 }], [{ x: 300, y: 300 }, { x: 500, y: 300 }], wide).zoom).toBe(0)
  })
})
