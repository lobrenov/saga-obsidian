import { useSyncExternalStore } from 'react'
import { clamp, fit, panBy, toImage, zoomAt, type Rect, type Size, type Viewport, type ZoomLimits } from '../shared/maps/viewport'

/** Length of the zoom and pan animations of the buttons, double-click and keys. */
export const ANIMATION_MS = 150

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The map's viewport outside React state: readers (`get`, `view`) see every change at once and `subscribe` listeners run once
 * per animation frame after changes (in the same frame for an animation step), so the stage, pins, readout and popover follow it without re-rendering the whole map. The first non-empty view size
 * fits the image; later sizes keep the centre.
 */
export class ViewportStore {
  private v: Viewport
  private size: Size = { width: 0, height: 0 }
  private fitted = false
  private frame = 0
  private target: Viewport | null = null
  private notifyFrame = 0
  private readonly listeners = new Set<() => void>()

  constructor(
    readonly image: Size,
    readonly limits: ZoomLimits
  ) {
    this.v = { zoom: 0, cx: image.width / 2, cy: image.height / 2 }
  }

  get(): Viewport {
    return this.v
  }

  view(): Size {
    return this.size
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  /** The view's size in px; the first non-empty size fits the image. */
  setView(size: Size): void {
    if (size.width === this.size.width && size.height === this.size.height) return
    this.size = size
    if (!this.fitted && size.width > 0 && size.height > 0) {
      this.fitted = true
      this.apply(fit(this.image, size))
    } else this.apply(this.v)
  }

  /** Sets the viewport (clamped to the image and the zoom limits), stopping any animation. */
  set(v: Viewport): void {
    this.stop()
    this.apply(v)
  }

  fit(): void {
    this.set(fit(this.image, this.size))
  }

  panBy(dx: number, dy: number): void {
    this.set(panBy(this.v, dx, dy))
  }

  zoomAt(sx: number, sy: number, dz: number): void {
    this.set(zoomAt(this.v, this.size, sx, sy, dz, this.limits))
  }

  /** The image point at a screen point of the view. */
  toImage(sx: number, sy: number): { x: number; y: number } {
    return toImage(this.v, this.size, sx, sy)
  }

  /** Zooms by `dz` levels around a screen point (the view's centre by default), animated unless motion is reduced. Steps while animating add up. */
  zoomStep(dz: number, sx = this.size.width / 2, sy = this.size.height / 2): void {
    this.animate(zoomAt(this.target ?? this.v, this.size, sx, sy, dz, this.limits))
  }

  /** Moves the image by `dx`, `dy` screen pixels, animated unless motion is reduced. Steps while animating add up. */
  panStep(dx: number, dy: number): void {
    this.animate(panBy(this.target ?? this.v, dx, dy))
  }

  /** Zooms and moves to show an image rectangle with `padding` screen px around it (zoom capped at the limit), animated unless motion is reduced. */
  fitRect(rect: Rect, padding: number): void {
    const w = rect.right - rect.left
    const h = rect.bottom - rect.top
    const room = Math.min((this.size.width - 2 * padding) / w, (this.size.height - 2 * padding) / h)
    const zoom = room > 0 ? Math.min(this.limits.max, Math.log2(room)) : this.limits.max
    this.animate({ zoom, cx: (rect.left + rect.right) / 2, cy: (rect.top + rect.bottom) / 2 })
  }

  /** Stops a running animation. */
  stop(): void {
    window.cancelAnimationFrame(this.frame)
    this.frame = 0
    this.target = null
  }

  private animate(to: Viewport): void {
    const goal = clamp(to, this.image, this.size, this.limits)
    const from = this.v
    this.stop()
    if (reducedMotion()) {
      this.apply(goal)
      return
    }
    this.target = goal
    const start = performance.now()
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / ANIMATION_MS)
      const e = 1 - (1 - t) ** 2
      this.apply({ zoom: from.zoom + (goal.zoom - from.zoom) * e, cx: from.cx + (goal.cx - from.cx) * e, cy: from.cy + (goal.cy - from.cy) * e }, true)
      if (t < 1) this.frame = window.requestAnimationFrame(step)
      else this.stop()
    }
    this.frame = window.requestAnimationFrame(step)
  }

  private apply(v: Viewport, now = false): void {
    this.v = clamp(v, this.image, this.size, this.limits)
    if (now) this.notify()
    else if (!this.notifyFrame) this.notifyFrame = window.requestAnimationFrame(this.notify)
  }

  private notify = (): void => {
    window.cancelAnimationFrame(this.notifyFrame)
    this.notifyFrame = 0
    for (const listener of this.listeners) listener()
  }
}

/** A value derived from the viewport, re-rendering only when it changes; `select` must return a primitive. */
export function useViewport<T extends string | number>(store: ViewportStore, select: (v: Viewport, view: Size) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get(), store.view()))
}
