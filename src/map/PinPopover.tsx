import { useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { setIcon } from 'obsidian'
import { toScreen } from '../shared/maps/viewport'
import { rendererDefs } from '../shared/renderers/definitions'
import { PIN_COLORS, SHAPES, type PinLook } from '../shared/pins/look'
import type { PinOp } from '../shared/schemas/pins'
import { toExcerpt } from '../shared/markdown/excerpt'
import type { MapHost } from './host'
import { MenuSelect } from '../ui/MenuSelect'
import { SpriteContext } from './PinSprite'
import { iconLabel, pinColor, pinGlyphId } from './pinStyles'
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

/** The keys of a look to set; `null` removes one (back to the renderer's). */
export type LookChange = Omit<Extract<PinOp, { kind: 'look' }>, 'kind' | 'index'>

interface PinPopoverProps {
  store: ViewportStore
  host: MapHost
  pin: PlacedPin
  onClose: () => void
  onLook: (pin: PlacedPin, change: LookChange) => void
  busy: boolean
}

/** The card for a selected pin: the note (its title opens it), an excerpt and its shape, colour and icon. */
export function PinPopover({ store, host, pin, onClose, onLook, busy }: PinPopoverProps) {
  const ids = { title: useId(), shape: useId(), color: useId(), icon: useId() }
  const sprite = useContext(SpriteContext)
  const root = useRef<HTMLElement>(null)
  const [excerpt, setExcerpt] = useState('')
  const def = rendererDefs[pin.renderer]
  const path = pin.file.path

  // Focus moves into the card and goes back to where it was when the card closes.
  useLayoutEffect(() => {
    const before = root.current?.ownerDocument.activeElement
    root.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
    return () => {
      if (before?.instanceOf(HTMLElement) && before.isConnected) before.focus({ preventScroll: true })
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
      <p className="saga-map-popover-kind" style={{ color: pinColor(pin.look.color) }}>
        {def.label}
      </p>
      <h2 id={ids.title} className="saga-map-popover-title">
        <a
          href={pin.file.path}
          className="internal-link"
          data-autofocus
          onClick={(event) => {
            event.preventDefault()
            host.openNote(pin.file, event.metaKey || event.ctrlKey)
          }}
          onMouseOver={(event) => host.hoverNote(event.nativeEvent, event.currentTarget, pin.file)}
        >
          {pin.title}
        </a>
      </h2>
      {excerpt ? <p className="saga-map-popover-excerpt">{excerpt}</p> : null}
      <div className="saga-map-popover-look">
        <LookRow id={ids.shape} label="Shape" renderer={def.label} busy={busy} overridden={pin.look.shape !== pin.defaults.shape} onReset={() => onLook(pin, { shape: null })}>
          <MenuSelect id={ids.shape} value={pin.look.shape} options={SHAPES.map((shape) => ({ value: shape.id, label: shape.label }))} disabled={busy} showMenu={host.showMenu} onChange={(shape) => onLook(pin, { shape: shape === pin.defaults.shape ? null : (shape as PinLook['shape']) })} />
        </LookRow>
        <LookRow id={ids.color} label="Colour" renderer={def.label} busy={busy} overridden={pin.look.color !== pin.defaults.color} onReset={() => onLook(pin, { color: null })}>
          <MenuSelect id={ids.color} value={pin.look.color} options={PIN_COLORS.map((color) => ({ value: color.id, label: color.name }))} disabled={busy} showMenu={host.showMenu} onChange={(color) => onLook(pin, { color: color === pin.defaults.color ? null : (color as PinLook['color']) })} />
        </LookRow>
        <LookRow id={ids.icon} label="Icon" renderer={def.label} busy={busy} overridden={pin.look.icon !== pin.defaults.icon} onReset={() => onLook(pin, { icon: null })}>
          <button
            type="button"
            id={ids.icon}
            className="dropdown saga-menu-select"
            disabled={busy}
            onClick={() =>
              void host.pickIcon().then((icon) => {
                if (icon !== null && icon !== pin.look.icon) onLook(pin, { icon: icon === pin.defaults.icon ? null : icon })
              })
            }
          >
            <svg aria-hidden="true" className="saga-map-glyph" width="14" height="14" viewBox="0 0 24 24">
              <use href={`#${pinGlyphId(sprite, pin.look.icon)}`} />
            </svg>
            {iconLabel(pin.look.icon)}
          </button>
        </LookRow>
      </div>
      {pin.issues.length > 0 ? (
        <ul className="saga-map-popover-issues" aria-label="Problems with this pin">
          {pin.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/** A labelled card row with a reset button ("Use <Renderer> default") beside its control while the pin overrides it. */
function LookRow({ id, label, renderer, overridden, busy, onReset, children }: { id: string; label: string; renderer: string; overridden: boolean; busy: boolean; onReset: () => void; children: ReactNode }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="saga-map-popover-control">
        {children}
        {overridden ? (
          <button
            type="button"
            className="clickable-icon saga-map-popover-reset"
            aria-label={`Use ${renderer} default`}
            title={`Use ${renderer} default`}
            disabled={busy}
            onClick={onReset}
            ref={(el) => {
              if (el) setIcon(el, 'rotate-ccw')
            }}
          />
        ) : null}
      </div>
    </>
  )
}
