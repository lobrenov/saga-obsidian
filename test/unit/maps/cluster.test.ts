import { describe, expect, it } from 'vitest'
import { CLUSTER_CELL, CLUSTER_THRESHOLD, clusterItems } from '../../../src/shared/pins/cluster'

const item = (key: string, px: number, py: number) => ({ key, px, py })
const grid = (n: number, step: number, origin = 0) => Array.from({ length: n }, (_, i) => item(`p${i}`, origin + (i % 10) * step, origin + Math.floor(i / 10) * step))

describe('clusterItems', () => {
  it('keeps every pin single up to the threshold', () => {
    const items = grid(CLUSTER_THRESHOLD, 2)
    const out = clusterItems(items)
    expect(out).toHaveLength(CLUSTER_THRESHOLD)
    expect(out.every((c) => c.items.length === 1)).toBe(true)
  })

  it('merges pins that share a screen cell above the threshold', () => {
    const items = grid(CLUSTER_THRESHOLD + 10, 2)
    const out = clusterItems(items)
    expect(out.length).toBeLessThan(items.length)
    expect(out.flatMap((c) => c.items.map((i) => i.key)).sort()).toEqual(items.map((i) => i.key).sort())
  })

  it('keeps pins in different cells apart and puts a cluster at the mean position', () => {
    const items = [...grid(CLUSTER_THRESHOLD, CLUSTER_CELL * 2, 1000), item('a', 10, 10), item('b', 20, 30)]
    const merged = clusterItems(items).find((c) => c.items.some((i) => i.key === 'a'))
    expect(merged?.items.map((i) => i.key).sort()).toEqual(expect.arrayContaining(['a', 'b']))
    expect(merged?.px).toBeCloseTo(15)
    expect(merged?.py).toBeCloseTo(20)
  })

  it('never merges kept pins, and can be switched off with an infinite threshold', () => {
    const items = grid(CLUSTER_THRESHOLD + 10, 1)
    const out = clusterItems(items, new Set(['p3']))
    expect(out.find((c) => c.items.some((i) => i.key === 'p3'))?.items).toHaveLength(1)
    expect(clusterItems(items, new Set(), Infinity)).toHaveLength(items.length)
  })
})
