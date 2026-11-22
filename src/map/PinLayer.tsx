import { memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { toScreen } from '../shared/maps/viewport'
import { rendererDefs } from '../shared/renderers/definitions'
import { clusterItems } from '../shared/pins/cluster'
import type { PinLabels } from '../obsidian/prefs'
import { FALLBACK_ICON, type PinLook } from '../shared/pins/look'
import { clusterHtml, ghostHtml, pinClass, pinHtml } from './pinIcons'
import { labelOffset, placeLabels, type LabelSlot } from './labels'
import { SpriteContext } from './PinSprite'
import { anchoredBox, iconLabel, shapeDef } from './pinStyles'
import { pinKey, type PlacedPin } from './types'
import type { ViewportStore } from './viewportStore'

/** What a screen reader hears after a pin's title: its renderer and icon. */
export const pinDescription = (pin: PlacedPin): string => `${rendererDefs[pin.renderer].label}, ${iconLabel(pin.look.icon)}`

/** Pins and clusters more than this far (screen px) outside the view are culled: not repositioned, drawn invisible (but still focusable). */
const CULL_PX = 150
/** A press moves a pin only after this many px, so a click or Enter still selects it. */
const DRAG_PX = 4
/** Clusters are recomputed this long after the zoom settles. */
const CLUSTER_SETTLE_MS = 150
/** A cluster fits its pins with this padding. */
const CLUSTER_PADDING_PX = 48

type Placement<T> = readonly [RefObject<T | null>, (force?: boolean) => void]

/**
 * A ref for an element at image point `x`, `y` whose transform follows the viewport without a re-render, and `place` to write it now.
 * An element far outside the view is marked `data-culled` and not repositioned; `force` places it anyway (focus). While `held` is
 * true the element is not placed (a pin being dragged).
 */
function usePlacement<T extends HTMLElement>(store: ViewportStore, x: number, y: number, held?: RefObject<boolean>): Placement<T> {
  const ref = useRef<T>(null)
  const place = useCallback(
    (force = false): void => {
      const el = ref.current
      if (!el || held?.current) return
      const view = store.view()
      const point = toScreen(store.get(), view, x, y)
      const culled = !force && (point.x < -CULL_PX || point.x > view.width + CULL_PX || point.y < -CULL_PX || point.y > view.height + CULL_PX)
      el.toggleAttribute('data-culled', culled)
      if (!culled) el.style.transform = `translate(${point.x}px, ${point.y}px)`
    },
    [store, x, y, held]
  )
  useLayoutEffect(() => {
    place()
    return store.subscribe(() => place())
  }, [store, place])
  return [ref, place]
}

interface PinButtonProps {
  store: ViewportStore
  pin: PlacedPin
  selected: boolean
  onSelect: (pin: PlacedPin) => void
  /** Resolves true when the move was written. */
  onMoved: (pin: PlacedPin, x: number, y: number) => Promise<boolean>
  onDragStart: (pin: PlacedPin) => void
  onDragEnd: () => void
  onFocusPin: (key: string | null) => void
  /** The pin under the pointer, null when it leaves. */
  onReveal: (key: string | null) => void
  /** The pin's menu (right-click, ContextMenu key) at a screen point. */
  onMenu: (pin: PlacedPin, screen: { x: number; y: number }) => void
  onHover: (event: ReactMouseEvent<HTMLElement>, pin: PlacedPin) => void
}

interface Drag {
  id: number
  /** Pointer position at the press and the pin's screen position then. */
  x: number
  y: number
  tipX: number
  tipY: number
  moved: boolean
}

const PinButton = memo(function PinButton({ store, pin, selected, onSelect, onMoved, onDragStart, onDragEnd, onFocusPin, onReveal, onMenu, onHover }: PinButtonProps) {
  const held = useRef(false)
  const sprite = useContext(SpriteContext)
  const [ref, place] = usePlacement<HTMLButtonElement>(store, pin.x, pin.y, held)
  const html = useMemo(() => pinHtml({ sprite, title: pin.title, description: pinDescription(pin), look: pin.look }), [sprite, pin])
  const drag = useRef<Drag | null>(null)
  const dragged = useRef(false)

  /** Ends a drag; the pin is released for placing (and no longer counts as dragged unless `keepKey`). */
  const end = (keepKey = false): void => {
    drag.current = null
    if (!held.current) return
    held.current = false
    if (!keepKey) onDragEnd()
  }
  /** Ends a drag that does not write: the pin goes back to its place. */
  const cancel = (): void => {
    end()
    place()
  }
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return
    dragged.current = false
    const at = toScreen(store.get(), store.view(), pin.x, pin.y)
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, tipX: at.x, tipY: at.y, moved: false }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const d = drag.current
    if (!d || d.id !== event.pointerId) return
    // A release that was missed (outside the window) ends the drag here.
    if ((event.buttons & 1) === 0) {
      cancel()
      return
    }
    if (!d.moved) {
      if (Math.hypot(event.clientX - d.x, event.clientY - d.y) < DRAG_PX) return
      d.moved = true
      dragged.current = true
      held.current = true
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // A pointer that is not active (a synthetic one) cannot be captured; its events still reach the pin.
      }
      onDragStart(pin)
    }
    event.currentTarget.style.transform = `translate(${d.tipX + event.clientX - d.x}px, ${d.tipY + event.clientY - d.y}px)`
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const d = drag.current
    if (!d || d.id !== event.pointerId) return
    if (!d.moved) {
      drag.current = null
      return
    }
    const box = event.currentTarget.parentElement?.getBoundingClientRect()
    const inside = box !== undefined && event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!inside) {
      cancel()
      return
    }
    const at = store.toImage(d.tipX + event.clientX - d.x, d.tipY + event.clientY - d.y)
    // The stage holds the pin at the drop point until the base reports the write (or the write fails); it stays out of clusters meanwhile.
    end(true)
    void onMoved(pin, at.x, at.y).finally(onDragEnd)
  }
  return (
    <button
      ref={ref}
      type="button"
      data-pin={pinKey(pin)}
      className={pinClass}
      style={selected ? { ...anchoredBox(shapeDef(pin.look.shape)), zIndex: 1 } : anchoredBox(shapeDef(pin.look.shape))}
      onClick={(event) => {
        // The click that ends a drag is ignored; a keyboard or assistive click (detail 0) always selects.
        const afterDrag = dragged.current
        dragged.current = false
        if (!afterDrag || event.detail === 0) onSelect(pin)
      }}
      onFocus={() => {
        place(true)
        onFocusPin(pinKey(pin))
      }}
      onBlur={() => onFocusPin(null)}
      onMouseOver={(event) => onHover(event, pin)}
      onContextMenu={(event) => {
        event.preventDefault()
        onMenu(pin, { x: event.clientX, y: event.clientY })
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
        event.preventDefault()
        event.stopPropagation()
        const box = event.currentTarget.getBoundingClientRect()
        onMenu(pin, { x: box.left + box.width / 2, y: box.top + box.height / 2 })
      }}
      onMouseEnter={() => onReveal(pinKey(pin))}
      onMouseLeave={() => onReveal(null)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancel}
      onLostPointerCapture={(event) => {
        // Only the pin's own capture counts: a touch's implicit capture on the shape under it is lost when the pin captures.
        if (event.target === event.currentTarget && drag.current?.moved) cancel()
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

interface Group {
  key: string
  pins: PlacedPin[]
  x: number
  y: number
}

const single = (pin: PlacedPin): Group => ({ key: pinKey(pin), pins: [pin], x: pin.x, y: pin.y })

/** Groups pins by a screen grid at `zoom` (see `clusterItems`); the pins in `keep` stay single, and the closest zoom never clusters. */
function groupPins(pins: readonly PlacedPin[], zoom: number, atClosest: boolean, keep: ReadonlySet<string>): Group[] {
  const scale = 2 ** zoom
  const items = pins.map((pin) => ({ key: pinKey(pin), px: pin.x * scale, py: pin.y * scale, pin }))
  return clusterItems(items, keep, atClosest ? Infinity : undefined).map((cluster) => {
    const group = cluster.items.map((item) => item.pin)
    const [first] = group
    if (group.length === 1 && first) return single(first)
    return { key: `cluster:${cluster.items.map((i) => i.key).join('|')}`, pins: group, x: group.reduce((sum, p) => sum + p.x, 0) / group.length, y: group.reduce((sum, p) => sum + p.y, 0) / group.length }
  })
}

const ClusterButton = memo(function ClusterButton({ store, group, onActivate }: { store: ViewportStore; group: Group; onActivate: (group: Group) => void }) {
  const [ref, place] = usePlacement<HTMLButtonElement>(store, group.x, group.y)
  const html = useMemo(() => clusterHtml(group.pins.length), [group.pins.length])
  const zoomIn = (): void => {
    const xs = group.pins.map((p) => p.x)
    const ys = group.pins.map((p) => p.y)
    onActivate(group)
    store.fitRect({ left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }, CLUSTER_PADDING_PX)
  }
  return <button ref={ref} type="button" data-map-cluster={group.pins.length} className="saga-map-cluster-placed saga-map-cluster" onClick={zoomIn} onFocus={() => place(true)} dangerouslySetInnerHTML={{ __html: html }} />
})

interface PinLayerProps {
  store: ViewportStore
  pins: readonly PlacedPin[]
  selectedKey: string | null
  labels: PinLabels
  onSelect: (pin: PlacedPin) => void
  /** Resolves true when the move was written. */
  onMoved: (pin: PlacedPin, x: number, y: number) => Promise<boolean>
  onDragStart: () => void
  onHover: (event: ReactMouseEvent<HTMLElement>, pin: PlacedPin) => void
  onMenu: (pin: PlacedPin, screen: { x: number; y: number }) => void
}

/**
 * The pins of the map as buttons in the overlay above the image. Above the threshold nearby pins merge into cluster buttons,
 * regrouped 150 ms after the zoom settles; the selected pin and the pin being dragged never merge.
 */
export function PinLayer({ store, pins, selectedKey, labels, onSelect, onMoved, onDragStart, onHover, onMenu }: PinLayerProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [slots, setSlots] = useState<ReadonlyMap<string, LabelSlot | null>>(new Map())
  /** After a cluster is activated, the first of its pins takes focus once they show as pins (until `until`). */
  const refocus = useRef<{ key: string; until: number } | null>(null)
  useEffect(() => {
    if (dragKey && !pins.some((pin) => pinKey(pin) === dragKey)) setDragKey(null)
  }, [pins, dragKey])
  useEffect(() => {
    let zoom = NaN
    let timer: ReturnType<typeof setTimeout> | undefined
    let current: Group[] = []
    const keep = new Set([selectedKey, dragKey, focusKey].filter((key): key is string => key !== null))
    const relabel = (): void => {
      const view = store.view()
      const targets = current.map((group) => {
        const at = toScreen(store.get(), view, group.x, group.y)
        const only = group.pins.length === 1 ? group.pins[0] : undefined
        return { key: group.key, title: only?.title ?? null, shape: only?.look.shape, px: at.x, py: at.y }
      })
      setSlots(placeLabels(targets, view))
    }
    const regroup = (): void => {
      zoom = store.get().zoom
      current = groupPins(pins, zoom, zoom >= store.limits.max, keep)
      setGroups(current)
      relabel()
    }
    regroup()
    const unsubscribe = store.subscribe(() => {
      clearTimeout(timer)
      timer = setTimeout(() => (store.get().zoom === zoom ? relabel() : regroup()), CLUSTER_SETTLE_MS)
    })
    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [store, pins, selectedKey, dragKey, focusKey])
  useEffect(() => {
    const wanted = refocus.current
    if (!wanted) return
    if (Date.now() > wanted.until) refocus.current = null
    else {
      const pin = [...document.querySelectorAll<HTMLElement>('[data-pin]')].find((el) => el.dataset['pin'] === wanted.key)
      if (pin) {
        refocus.current = null
        pin.focus({ preventScroll: true })
      }
    }
  }, [groups])
  const dragStart = useCallback(
    (pin: PlacedPin) => {
      setDragKey(pinKey(pin))
      onDragStart()
    },
    [onDragStart]
  )
  const dragEnd = useCallback(() => setDragKey(null), [])
  const activate = useCallback((group: Group) => {
    const [first] = group.pins
    if (first) refocus.current = { key: pinKey(first), until: Date.now() + 2000 }
  }, [])

  const singles = groups.flatMap((group) => (group.pins.length === 1 && group.pins[0] ? [group.pins[0]] : []))
  const slotOf = (pin: PlacedPin): LabelSlot | null => (pinKey(pin) === dragKey ? null : (slots.get(pinKey(pin)) ?? null))
  const always = labels === 'always'
  const shown = always ? singles.filter((pin) => slotOf(pin) !== null) : []
  const revealed = singles.filter((pin) => (!always || slotOf(pin) === null) && pinKey(pin) !== dragKey && [hoverKey, focusKey].includes(pinKey(pin)))

  return (
    <>
      {shown.map((pin) => (
        <PinLabel key={pinKey(pin)} store={store} pin={pin} slot={slotOf(pin) ?? 'right'} />
      ))}
      {groups.map((group) => {
        const [first] = group.pins
        if (group.pins.length === 1 && first) {
          return <PinButton key={group.key} store={store} pin={first} selected={group.key === selectedKey} onSelect={onSelect} onMoved={onMoved} onDragStart={dragStart} onDragEnd={dragEnd} onFocusPin={setFocusKey} onReveal={setHoverKey} onMenu={onMenu} onHover={onHover} />
        }
        return <ClusterButton key={group.key} store={store} group={group} onActivate={activate} />
      })}
      {revealed.map((pin) => (
        <PinLabel key={`reveal:${pinKey(pin)}`} store={store} pin={pin} slot="right" top />
      ))}
    </>
  )
}

/** A pin's label, in its own layer so pins stay above labels; a label with no free slot (or all of them in hover mode) is shown only on hover or focus, on top. */
const PinLabel = memo(function PinLabel({ store, pin, slot, top }: { store: ViewportStore; pin: PlacedPin; slot: LabelSlot; top?: boolean }) {
  const [ref] = usePlacement<HTMLDivElement>(store, pin.x, pin.y)
  return (
    <div ref={ref} className={`saga-map-label-anchor${top ? ' saga-map-label-top' : ''}`}>
      <span className={`saga-map-label saga-map-label-${slot}`} style={labelOffset(shapeDef(pin.look.shape), slot)} aria-hidden="true">
        {pin.title}
      </span>
    </div>
  )
})

const GHOST_LOOK: PinLook = { shape: 'pin', color: 'slate', icon: FALLBACK_ICON }

/** A pin at a fixed place that is not saved yet (the new pin while its note is picked and written). */
export function FixedGhost({ store, x, y }: { store: ViewportStore; x: number; y: number }) {
  const [ref] = usePlacement<HTMLDivElement>(store, x, y)
  const sprite = useContext(SpriteContext)
  const html = useMemo(() => ghostHtml(sprite, GHOST_LOOK), [sprite])
  return <div ref={ref} data-map-ghost="" className="saga-map-placed saga-map-pin-ghost" style={anchoredBox(shapeDef(GHOST_LOOK.shape))} dangerouslySetInnerHTML={{ __html: html }} />
}
