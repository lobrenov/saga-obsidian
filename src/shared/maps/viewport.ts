/** Pixel dimensions of an image or of the map view. */
export interface Size {
  width: number
  height: number
}

/** `zoom` is log2 of screen pixels per image pixel; `cx`, `cy` is the image point at the view's centre. */
export interface Viewport {
  zoom: number
  cx: number
  cy: number
}

/** A rectangle in image pixels. */
export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

const scale = (zoom: number): number => 2 ** zoom

/** The whole image, centred (zoom 0 when the image or the view has no size). */
export function fit(image: Size, view: Size): Viewport {
  const cx = image.width / 2
  const cy = image.height / 2
  if (!(image.width > 0 && image.height > 0 && view.width > 0 && view.height > 0)) return { zoom: 0, cx, cy }
  return { zoom: Math.log2(Math.min(view.width / image.width, view.height / image.height)), cx, cy }
}

/** The image point at a screen point (px from the view's top left). */
export function toImage(v: Viewport, view: Size, sx: number, sy: number): { x: number; y: number } {
  const s = scale(v.zoom)
  return {
    x: v.cx + (sx - view.width / 2) / s,
    y: v.cy + (sy - view.height / 2) / s
  }
}

/** The screen point (px from the view's top left) of an image point. */
export function toScreen(v: Viewport, view: Size, x: number, y: number): { x: number; y: number } {
  const s = scale(v.zoom)
  return {
    x: view.width / 2 + (x - v.cx) * s,
    y: view.height / 2 + (y - v.cy) * s
  }
}

/** Zoom by `dz` levels (the result stays within `limits`), keeping the image point under the screen point fixed. */
export function zoomAt(v: Viewport, view: Size, sx: number, sy: number, dz: number, limits: ZoomLimits): Viewport {
  const p = toImage(v, view, sx, sy)
  const zoom = Math.min(limits.max, Math.max(limits.min, v.zoom + dz))
  const s = scale(zoom)
  return {
    zoom,
    cx: p.x - (sx - view.width / 2) / s,
    cy: p.y - (sy - view.height / 2) / s
  }
}

/** Move the image by `dx`, `dy` screen pixels (the view centre moves the opposite way in the image). */
export function panBy(v: Viewport, dx: number, dy: number): Viewport {
  const s = scale(v.zoom)
  return { zoom: v.zoom, cx: v.cx - dx / s, cy: v.cy - dy / s }
}

/** The image rectangle the view shows. */
export function visibleRect(v: Viewport, view: Size): Rect {
  const a = toImage(v, view, 0, 0)
  const b = toImage(v, view, view.width, view.height)
  return { left: a.x, top: a.y, right: b.x, bottom: b.y }
}

/** Zoom bounds as log2 screen px per image px. */
export interface ZoomLimits {
  min: number
  max: number
}

/**
 * Limits for a single image: out until its longest side is about 64 px, in to 8x.
 */
export function imageZoomLimits(image: Size): ZoomLimits {
  return {
    min: -Math.max(0, Math.ceil(Math.log2(Math.max(image.width, image.height) / 128))) - 1,
    max: 3
  }
}

/** Clamp the zoom to `limits` and the centre so at least a quarter of the view (or all of a smaller image) shows the image. */
export function clamp(v: Viewport, image: Size, view: Size, limits: ZoomLimits): Viewport {
  const zoom = Math.min(limits.max, Math.max(limits.min, v.zoom))
  const s = scale(zoom)
  const axis = (c: number, size: number, viewSize: number): number => {
    const slack = (viewSize / 2 - Math.min(viewSize / 4, size * s)) / s
    return Math.min(size + slack, Math.max(-slack, c))
  }
  return {
    zoom,
    cx: axis(v.cx, image.width, view.width),
    cy: axis(v.cy, image.height, view.height)
  }
}
