import { useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type UIEvent } from 'react'
import { toScreen } from '../shared/maps/viewport'
import { attachTouch } from './touch'
import { attachTrackpad } from './trackpad'
import type { ViewportStore } from './viewportStore'

/** A pointer must move this far before a press becomes a drag (a smaller movement is still a click). */
const DRAG_PX = 4
/** An arrow key pans the image this far. */
const KEY_PAN_PX = 80
const KEY_ZOOM: Record<string, number> = { '+': 1, '=': 1, '-': -1, _: -1 }
const KEY_PAN: Record<string, readonly [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
/** A focused pin is panned at least this far inside the view. */
const FOCUS_MARGIN_PX = 48
const OVER_PIN = '[data-pin],[data-map-cluster]'

interface MapCanvasProps {
  store: ViewportStore
  imageUrl: string
  title: string
  /** A click on the map itself (not a pin or a drag), in image pixels. */
  onMapClick: (at: { x: number; y: number }) => void
  /** A right-click on the map (not a pin) or the ContextMenu key on the stage: the image point and the screen point for the menu. */
  onMapMenu: (at: { x: number; y: number }, screen: { x: number; y: number }) => void
  stageRef: (element: HTMLDivElement | null) => void
  /** Drawn in an untransformed overlay above the image (pins, ghosts). */
  children: ReactNode
}

/**
 * The map surface: a container (`data-map-stage`) with one 0×0 layer that the viewport moves with `translate3d` and `scale`
 * (written straight to the style, no re-render), holding the image in image pixels. Wheel, pinch, drag, touch, double-click
 * and keys move the viewport.
 */
export function MapCanvas({ store, imageUrl, title, onMapClick, onMapMenu, stageRef, children }: MapCanvasProps) {
  const element = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const dragged = useRef(false)

  useLayoutEffect(() => {
    const stage = element.current
    const target = layer.current
    if (!stage || !target) return undefined
    const place = (): void => {
      const v = store.get()
      const at = toScreen(v, store.view(), 0, 0)
      target.style.transform = `translate3d(${at.x}px, ${at.y}px, 0) scale(${2 ** v.zoom})`
    }
    const resize = (): void => store.setView({ width: stage.clientWidth, height: stage.clientHeight })
    resize()
    place()
    const unsubscribe = store.subscribe(place)
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    const detachTouch = attachTouch(stage, store)
    const detach = attachTrackpad(stage, store)
    return () => {
      detach()
      detachTouch()
      observer.disconnect()
      unsubscribe()
      store.stop()
    }
  }, [store])

  const pointOf = (event: { clientX: number; clientY: number }): { x: number; y: number } => {
    const box = element.current?.getBoundingClientRect()
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) }
  }
  const overPin = (event: { target: EventTarget }): boolean => event.target instanceof Element && event.target.closest(OVER_PIN) !== null

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || overPin(event)) return
    dragged.current = false
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current
    if (!d || d.id !== event.pointerId) return
    // A release that was missed (over an overlay, outside the window) ends the drag here.
    if ((event.buttons & 1) === 0) {
      onPointerEnd(event)
      return
    }
    if (!d.moved) {
      if (Math.hypot(event.clientX - d.x, event.clientY - d.y) < DRAG_PX) return
      d.moved = true
      dragged.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    store.panBy(event.clientX - d.x, event.clientY - d.y)
    d.x = event.clientX
    d.y = event.clientY
  }
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>): void => {
    if (drag.current?.id !== event.pointerId) return
    if (drag.current.moved && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    drag.current = null
  }
  // Only the stage's own capture counts: a touch's implicit capture on the element under it is lost when the stage captures.
  const onLostPointerCapture = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget && drag.current?.id === event.pointerId) drag.current = null
  }
  // Both containers clip, but focus can still scroll them; the viewport is the only thing that moves the map.
  const unscroll = (event: UIEvent<HTMLDivElement>): void => {
    event.currentTarget.scrollTop = 0
    event.currentTarget.scrollLeft = 0
  }
  // A pin focused off screen (Tab) is panned into view.
  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    const pin = event.target instanceof Element ? event.target.closest(OVER_PIN) : null
    const stage = element.current
    if (!pin || !stage) return
    stage.scrollTop = 0
    stage.scrollLeft = 0
    if (overlay.current) {
      overlay.current.scrollTop = 0
      overlay.current.scrollLeft = 0
    }
    const box = stage.getBoundingClientRect()
    const rect = pin.getBoundingClientRect()
    const inside = (v: number, lo: number, hi: number): number => (v < lo ? lo - v : v > hi ? hi - v : 0)
    const dx = inside(rect.left + rect.width / 2 - box.left, FOCUS_MARGIN_PX, box.width - FOCUS_MARGIN_PX)
    const dy = inside(rect.top - box.top, FOCUS_MARGIN_PX, box.height - FOCUS_MARGIN_PX)
    if (dx !== 0 || dy !== 0) store.panBy(dx, dy)
  }
  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (dragged.current || overPin(event)) return
    const at = pointOf(event)
    onMapClick(store.toImage(at.x, at.y))
  }
  const onDoubleClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (overPin(event)) return
    const at = pointOf(event)
    store.zoomStep(1, at.x, at.y)
  }
  const onContextMenu = (event: MouseEvent<HTMLDivElement>): void => {
    event.preventDefault()
    if (overPin(event)) return
    const at = pointOf(event)
    onMapMenu(store.toImage(at.x, at.y), { x: event.clientX, y: event.clientY })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault()
      const box = event.currentTarget.getBoundingClientRect()
      const centre = store.get()
      onMapMenu({ x: centre.cx, y: centre.cy }, { x: box.left + box.width / 2, y: box.top + box.height / 2 })
      return
    }
    const zoom = KEY_ZOOM[event.key]
    const pan = KEY_PAN[event.key]
    if (zoom !== undefined) store.zoomStep(zoom)
    else if (pan) store.panStep(pan[0] * KEY_PAN_PX, pan[1] * KEY_PAN_PX)
    else return
    event.preventDefault()
  }

  return (
    <div
      ref={(node) => {
        element.current = node
        stageRef(node)
      }}
      className="saga-map-stage"
      data-map-stage=""
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onLostPointerCapture}
      onScroll={unscroll}
      onFocus={onFocus}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
    >
      <div ref={layer} className="saga-map-layer">
        <img data-map-image="" className="saga-map-image" src={imageUrl} alt={`Map image: ${title}`} width={store.image.width} height={store.image.height} draggable={false} />
      </div>
      <div ref={overlay} className="saga-map-pins" onScroll={unscroll}>
        {children}
      </div>
    </div>
  )
}
