import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { toScreen } from '../shared/maps/viewport'
import { rendererDefs } from '../shared/renderers/definitions'
import { PIN_STYLES, type PinStyle } from '../shared/schemas/pins'
import { toExcerpt } from './excerpt'
import type { MapHost } from './host'
import { STYLE_LABELS, pinColor } from './pinStyles'
import type { PlacedPin } from './types'
import type { ViewportStore } from './viewportStore'

const WIDTH = 290
const GAP = 22
/** The card keeps at least this much of its height inside the view. */
const MIN_VISIBLE = 160
const EXCERPT_CHARS = 140

/** The card's place beside the pin's screen position (a pin at `x`, `y`), on the side with room. */
function cardPlace(store: ViewportStore, x: number, y: number): { left: number; top: number; side: 'left' | 'right' } {
  const at = toScreen(store.get(), store.view(), x, y)
  const { width, height } = store.view()
  const side = at.x - WIDTH - GAP >= 8 ? 'left' : 'right'
  const left = side === 'left' ? at.x - WIDTH - GAP : at.x + GAP
  // A pin that leaves the view leaves the card at the nearest edge of it.
  return { left: Math.min(Math.max(8, left), Math.max(8, width - WIDTH - 8)), top: Math.min(Math.max(8, at.y - 64), Math.max(8, height - MIN_VISIBLE)), side }
}

interface PinPopoverProps {
  store: ViewportStore
  host: MapHost
  pin: PlacedPin
  onClose: () => void
  onMove: (pin: PlacedPin) => void
  onStyle: (pin: PlacedPin, style: PinStyle) => void
  onRemove: (pin: PlacedPin) => void
  busy: boolean
}

/** The card for a selected pin: the note, where the pin is stored, its style, and Open note / Move / Remove. */
export function PinPopover({ store, host, pin, onClose, onMove, onStyle, onRemove, busy }: PinPopoverProps) {
  const ids = { title: useId(), style: useId() }
  const root = useRef<HTMLElement>(null)
  const [excerpt, setExcerpt] = useState('')
  const def = rendererDefs[pin.renderer]
  const path = pin.file.path

  // Focus moves into the card and goes back to where it was when the card closes.
  useLayoutEffect(() => {
    const before = document.activeElement
    root.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus({ preventScroll: true })
    }
  }, [path, pin.index])
  useEffect(() => {
    let live = true
    setExcerpt('')
    void host.excerpt(pin.file).then((text) => live && setExcerpt(toExcerpt(text, EXCERPT_CHARS)))
    return () => {
      live = false
    }
  }, [host, pin.file])

  const place = cardPlace(store, pin.x, pin.y)
  // The card follows the pin by writing its style from the viewport subscription, not by re-rendering.
  useLayoutEffect(() => {
    const follow = (): void => {
      const next = cardPlace(store, pin.x, pin.y)
      const el = root.current
      if (!el) return
      el.style.left = `${next.left}px`
      el.style.top = `${next.top}px`
      el.dataset['side'] = next.side
    }
    follow()
    return store.subscribe(follow)
  }, [store, pin.x, pin.y])

  return (
    <section ref={root} role="dialog" aria-labelledby={ids.title} className="saga-map-popover" data-side={place.side} style={{ left: place.left, top: place.top, width: WIDTH }}>
      <span aria-hidden="true" className="saga-map-popover-arrow" />
      <button type="button" className="saga-map-popover-close clickable-icon" aria-label="Close" onClick={onClose}>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </svg>
      </button>
      <p className="saga-map-popover-kind" style={{ color: pinColor('auto', pin.renderer) }}>
        {def.label}
      </p>
      <h2 id={ids.title} className="saga-map-popover-title">
        {pin.title}
      </h2>
      {excerpt ? <p className="saga-map-popover-excerpt">{excerpt}</p> : null}
      <p className="saga-map-popover-meta">
        Pin saved in <code>{pin.file.name}</code> → <code>map-pins</code>
      </p>
      <div className="saga-map-popover-style">
        <label htmlFor={ids.style}>Style</label>
        <select id={ids.style} className="dropdown" value={pin.style} disabled={busy} onChange={(event) => onStyle(pin, event.target.value as PinStyle)}>
          {PIN_STYLES.map((style) => (
            <option key={style} value={style}>
              {style === 'auto' ? `Auto (${def.label})` : STYLE_LABELS[style]}
            </option>
          ))}
        </select>
      </div>
      {pin.issues.length > 0 ? (
        <ul className="saga-map-popover-issues" aria-label="Problems with this pin">
          {pin.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      <div className="saga-map-popover-actions">
        <button type="button" className="mod-cta" data-autofocus onClick={(event) => host.openNote(pin.file, event.metaKey || event.ctrlKey)}>
          Open note
        </button>
        <button type="button" disabled={busy} onClick={() => onMove(pin)}>
          Move
        </button>
        <button type="button" className="mod-warning" disabled={busy} onClick={() => onRemove(pin)}>
          Remove pin
        </button>
      </div>
    </section>
  )
}
