import { useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { TFile } from 'obsidian'
import { imageZoomLimits } from '../shared/maps/viewport'
import { roundCoord } from '../shared/pins/ops'
import type { PinOp, PinStyle } from '../shared/schemas/pins'
import { ZoomControls, Readout } from './Controls'
import { clampToImage } from './geometry'
import type { MapHost } from './host'
import { MapCanvas } from './MapCanvas'
import { LayersPanel, NO_LAYERS, isVisible, type Layers } from './LayersPanel'
import { CursorGhost, FixedGhost, PinLayer } from './PinLayer'
import { PinList } from './PinList'
import { PinPopover } from './PinPopover'
import { PinSprite, SpriteContext } from './PinSprite'
import type { PinOpBuilder } from '../obsidian/vault'
import { entryMatcher, locateEntry } from './pinWrites'
import { pinKey, type PlacedPin } from './types'
import { ViewportStore } from './viewportStore'

export type MapTool = 'select' | 'add'

interface MapStageProps {
  host: MapHost
  title: string
  imageUrl: string
  /** The image's pixel size. */
  size: { width: number; height: number }
  pins: readonly PlacedPin[]
  tool: MapTool
  setTool: (tool: MapTool) => void
  listOpen: boolean
  labels: boolean
  layersOpen: boolean
}

const ARROWS: Record<string, readonly [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
/** Arrow keys move a pin about this many screen pixels (at least one image pixel); Shift moves it ten times as far. */
const NUDGE_PX = 2
/** A written change is shown as written for this long at most while the base catches up. */
const HOLD_MS = 3000

type Point = { x: number; y: number }
/** A pin shown at `to` until the base reports a position other than `from` (or `HOLD_MS` pass). */
type Held = { from: Point; to: Point }

/** The map of one image with its pins and the tools around it (layers, zoom, pin list, popover). */
export function MapStage({ host, title, imageUrl, size, pins, tool, setTool, listOpen, labels, layersOpen }: MapStageProps) {
  const sprite = useContext(SpriteContext)
  const root = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<HTMLElement | null>(null)
  const [layers, setLayers] = useState<Layers>(NO_LAYERS)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  /** Where a new pin goes while its note is picked and written, until the base lists one more pin. */
  const [draft, setDraft] = useState<(Point & { count: number | null }) | null>(null)
  const [moving, setMoving] = useState<{ pin: PlacedPin; x: number; y: number } | null>(null)
  const [held, setHeld] = useState<ReadonlyMap<string, Held>>(new Map())
  const [busy, setBusy] = useState(false)

  const { width, height } = size
  const store = useMemo(() => new ViewportStore({ width, height }, imageZoomLimits({ width, height })), [imageUrl, width, height])
  const activeLayers = layersOpen ? layers : NO_LAYERS

  const placed = useMemo(
    () =>
      pins.map((pin) => {
        const at = held.get(pinKey(pin))
        return at ? { ...pin, ...at.to } : pin
      }),
    [pins, held]
  )
  const visible = useMemo(() => placed.filter((pin) => isVisible(pin, activeLayers)), [placed, activeLayers])
  const shownPins = useMemo(() => (moving ? visible.filter((pin) => pinKey(pin) !== pinKey(moving.pin)) : visible), [visible, moving])
  const selected = selectedKey === null ? null : (placed.find((pin) => pinKey(pin) === selectedKey) ?? null)

  // The base reports a pin elsewhere than before the write (or the pin gone): the held position is dropped; so is a held new pin once a pin is added.
  useEffect(() => {
    setHeld((current) => {
      const next = new Map([...current].filter(([key, at]) => pins.some((pin) => pinKey(pin) === key && pin.x === at.from.x && pin.y === at.from.y)))
      return next.size === current.size ? current : next
    })
    setDraft((current) => (current && current.count !== null && pins.length > current.count ? null : current))
  }, [pins])
  const hold = useCallback((key: string, at: Held): void => {
    setHeld((current) => new Map(current).set(key, at))
    setTimeout(() => setHeld((current) => (current.get(key) === at ? new Map([...current].filter(([k]) => k !== key)) : current)), HOLD_MS)
  }, [])
  const release = useCallback((key: string): void => setHeld((current) => new Map([...current].filter(([k]) => k !== key))), [])

  const write = useCallback(
    async (file: TFile, build: PinOpBuilder): Promise<boolean> => {
      setBusy(true)
      const result = await host.updatePin(file, build)
      setBusy(false)
      if (!result.ok) host.notify(result.error.message)
      return result.ok
    },
    [host]
  )
  const locate = useCallback(
    (pin: PlacedPin, op: (index: number) => PinOp): PinOpBuilder =>
      (list) => {
        const index = locateEntry(list, pin.index, entryMatcher((link) => host.isMap(link, pin.file), pin.x, pin.y))
        return index === null ? null : op(index)
      },
    [host]
  )

  const fitMap = useCallback(() => store.fit(), [store])
  const closeCard = useCallback(() => setSelectedKey(null), [])
  const select = useCallback(
    (pin: PlacedPin, centre = false) => {
      setDraft(null)
      setMoving(null)
      setSelectedKey(pinKey(pin))
      if (centre) store.set({ ...store.get(), cx: pin.x, cy: pin.y })
    },
    [store]
  )

  const place = useCallback(
    (x: number, y: number): Point => {
      const at = clampToImage(x, y, width, height)
      return { x: roundCoord(at.x), y: roundCoord(at.y) }
    },
    [width, height]
  )

  const commitMove = useCallback(
    async (pin: PlacedPin, x: number, y: number): Promise<boolean> => {
      const key = pinKey(pin)
      const to = place(x, y)
      hold(key, { from: { x: pin.x, y: pin.y }, to })
      const done = await write(pin.file, locate(pin, (index) => ({ kind: 'move', index, x: to.x, y: to.y })))
      if (!done) release(key)
      return done
    },
    [write, locate, hold, release, place]
  )

  /** Asks for the note, then writes the pin; the ghost stays until the base lists the pin. */
  const addPin = async (at: Point): Promise<void> => {
    setSelectedKey(null)
    setDraft({ ...at, count: null })
    const file = await host.pickNote()
    if (!file) {
      setDraft(null)
      return
    }
    const done = await write(file, () => ({ kind: 'add', pin: { map: host.mapLink(file), x: at.x, y: at.y } }))
    if (!done) {
      setDraft(null)
      return
    }
    setDraft({ ...at, count: pins.length })
    setTool('select')
    setTimeout(() => setDraft(null), HOLD_MS)
  }

  const onMapClick = (p: Point): void => {
    if (moving) {
      const next = place(p.x, p.y)
      setMoving(null)
      void commitMove(moving.pin, next.x, next.y)
    } else if (tool === 'add' && !draft) void addPin(place(p.x, p.y))
    else setSelectedKey(null)
  }

  const startMove = useCallback((pin: PlacedPin) => {
    setSelectedKey(null)
    setDraft(null)
    setMoving({ pin, x: pin.x, y: pin.y })
  }, [])

  // Keyboard moving: the move box takes focus; arrows nudge, Shift in larger steps, Enter places (one write), Escape cancels.
  const movingRef = useRef(moving)
  movingRef.current = moving
  const moveBox = useRef<HTMLDivElement>(null)
  const isMoving = moving !== null
  useEffect(() => {
    if (!isMoving) return undefined
    const before = document.activeElement
    moveBox.current?.focus({ preventScroll: true })
    return () => {
      if (before instanceof HTMLElement && before !== document.body && before.isConnected) before.focus({ preventScroll: true })
    }
  }, [isMoving])
  const onMoveKey = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const current = movingRef.current
    if (!current || event.defaultPrevented) return
    const onButton = event.target instanceof HTMLElement && event.target.closest('button') !== null
    const arrow = ARROWS[event.key]
    if (arrow) {
      event.preventDefault()
      const step = Math.max(1, Math.round((NUDGE_PX / 2 ** store.get().zoom) * (event.shiftKey ? 10 : 1)))
      const next = { ...current, ...clampToImage(current.x + arrow[0] * step, current.y + arrow[1] * step, width, height) }
      movingRef.current = next
      setMoving(next)
    } else if (event.key === 'Enter' && !onButton) {
      event.preventDefault()
      setMoving(null)
      void commitMove(current.pin, current.x, current.y)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setMoving(null)
    }
  }

  // Escape closes the card or Add pin mode, in that order, when focus is inside this map view.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const view = root.current?.closest('.saga-map')
      if (event.key !== 'Escape' || event.defaultPrevented || !view || !(event.target instanceof Node) || !view.contains(event.target)) return
      if (selectedKey) setSelectedKey(null)
      else if (tool === 'add') setTool('select')
      else return
      event.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedKey, tool, setTool])

  useEffect(() => {
    if (tool !== 'add') setDraft((current) => (current?.count === null ? null : current))
  }, [tool])

  const addAtCentre = (): void => {
    const centre = store.get()
    setMoving(null)
    void addPin(place(centre.cx, centre.cy))
  }

  const restyle = async (pin: PlacedPin, style: PinStyle): Promise<void> => {
    await write(pin.file, locate(pin, (index) => ({ kind: 'style', index, style: style === 'auto' ? null : style })))
  }
  const remove = async (pin: PlacedPin): Promise<void> => {
    if (!(await host.confirmRemove(pin))) return
    if (await write(pin.file, locate(pin, (index) => ({ kind: 'remove', index })))) setSelectedKey(null)
  }
  const hover = useCallback((event: ReactMouseEvent<HTMLElement>, pin: PlacedPin) => host.hoverNote(event.nativeEvent, event.currentTarget, pin.file), [host])

  return (
    <div ref={root} className="saga-map-stage-row">
      <PinSprite id={sprite} />
      <div className="saga-map-canvas-wrap">
        <div className="saga-map-canvas" data-tool={tool === 'add' || moving ? 'add' : 'select'}>
          <MapCanvas store={store} imageUrl={imageUrl} title={title} onMapClick={onMapClick} stageRef={setStage}>
            <PinLayer store={store} pins={shownPins} selectedKey={selectedKey} labels={labels} onSelect={select} onMoved={commitMove} onDragStart={closeCard} onHover={hover} />
            {tool === 'add' && !draft && !moving ? <CursorGhost stage={stage} /> : null}
            {draft ? <FixedGhost store={store} x={draft.x} y={draft.y} /> : null}
            {moving ? <FixedGhost store={store} x={moving.x} y={moving.y} pin={moving.pin} /> : null}
          </MapCanvas>
        </div>

        {layersOpen ? <LayersPanel pins={placed} layers={layers} onChange={setLayers} /> : null}
        <ZoomControls store={store} onFit={fitMap} />
        <Readout store={store} stage={stage} />
        {selected && !moving ? <PinPopover store={store} host={host} pin={selected} busy={busy} onClose={closeCard} onMove={startMove} onStyle={(pin, style) => void restyle(pin, style)} onRemove={(pin) => void remove(pin)} /> : null}

        {tool === 'add' && !draft ? (
          <p role="status" className="saga-map-hint">
            Click the map to place a pin · Esc to cancel
          </p>
        ) : null}
        {moving ? (
          <div ref={moveBox} tabIndex={-1} role="status" className="saga-map-hint" onKeyDown={onMoveKey}>
            <span>
              Moving {moving.pin.title}: click the map, or use the arrow keys (Shift for larger steps), Enter to place, Esc to cancel · x {moving.x} · y {moving.y}
            </span>
            <button
              type="button"
              onClick={() => {
                setMoving(null)
                void commitMove(moving.pin, moving.x, moving.y)
              }}
            >
              Place
            </button>
            <button type="button" onClick={() => setMoving(null)}>
              Cancel
            </button>
          </div>
        ) : null}
      </div>
      {listOpen ? <PinList pins={visible} selectedKey={selectedKey} onSelect={(pin) => select(pin, true)} onMove={startMove} onAddAtCentre={addAtCentre} /> : null}
    </div>
  )
}
