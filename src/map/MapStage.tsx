import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { TFile } from 'obsidian'
import { imageZoomLimits } from '../shared/maps/viewport'
import { FALLBACK_ICON } from '../shared/pins/look'
import { roundCoord } from '../shared/pins/ops'
import type { PinOp } from '../shared/schemas/pins'
import { ZoomControls, Readout } from './Controls'
import { clampToImage } from './geometry'
import type { PinLabels } from '../obsidian/prefs'
import type { MapHost } from './host'
import { MapCanvas } from './MapCanvas'
import { LayersPanel, NO_LAYERS, isVisible, type Layers } from './LayersPanel'
import { FixedGhost, PinLayer } from './PinLayer'
import { PinPopover, type LookChange } from './PinPopover'
import { PinSprite, SpriteContext } from './PinSprite'
import type { PinOpBuilder } from '../obsidian/vault'
import { entryMatcher, locateEntry } from './pinWrites'
import { pinKey, type PlacedPin } from './types'
import { ViewportStore } from './viewportStore'

interface MapStageProps {
  host: MapHost
  title: string
  imageUrl: string
  /** The image's pixel size. */
  size: { width: number; height: number }
  pins: readonly PlacedPin[]
  labels: PinLabels
  /** Hidden layers apply (the view's `layers` option). */
  layersOn: boolean
  /** Where the layer toggles show: over the map, beside it, or not at all. */
  layersPanel: 'floating' | 'sidebar' | null
}

/** A written change is shown as written for this long at most while the base catches up. */
const HOLD_MS = 3000

type Point = { x: number; y: number }
/** A pin shown at `to` until the base reports a position other than `from` (or `HOLD_MS` pass). */
type Held = { from: Point; to: Point }

/** The map of one image with its pins and the tools around it (layers, zoom, popover). */
export function MapStage({ host, title, imageUrl, size, pins, labels, layersOn, layersPanel }: MapStageProps) {
  const sprite = useContext(SpriteContext)
  const root = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<HTMLElement | null>(null)
  const [layers, setLayers] = useState<Layers>(NO_LAYERS)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  /** Where a new pin goes while its note is picked and written, until the base lists one more pin. */
  const [draft, setDraft] = useState<(Point & { count: number | null }) | null>(null)
  const [held, setHeld] = useState<ReadonlyMap<string, Held>>(new Map())
  const [busy, setBusy] = useState(false)

  const { width, height } = size
  const store = useMemo(() => new ViewportStore({ width, height }, imageZoomLimits({ width, height })), [imageUrl, width, height])
  const icons = useMemo(() => [...new Set([FALLBACK_ICON, ...pins.map((pin) => pin.look.icon)])].sort(), [pins])
  const activeLayers = layersOn ? layers : NO_LAYERS

  const placed = useMemo(
    () =>
      pins.map((pin) => {
        const at = held.get(pinKey(pin))
        return at ? { ...pin, ...at.to } : pin
      }),
    [pins, held]
  )
  const visible = useMemo(() => placed.filter((pin) => isVisible(pin, activeLayers)), [placed, activeLayers])
  const selected = selectedKey === null ? null : (placed.find((pin) => pinKey(pin) === selectedKey) ?? null)

  // The base reports a pin elsewhere than before the write (or the pin gone): the held position is dropped.
  useEffect(() => {
    setHeld((current) => {
      const next = new Map([...current].filter(([key, at]) => pins.some((pin) => pinKey(pin) === key && pin.x === at.from.x && pin.y === at.from.y)))
      return next.size === current.size ? current : next
    })
  }, [pins])
  const hold = useCallback((key: string, at: Held): void => {
    setHeld((current) => new Map(current).set(key, at))
    window.setTimeout(() => setHeld((current) => (current.get(key) === at ? new Map([...current].filter(([k]) => k !== key)) : current)), HOLD_MS)
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
  const select = useCallback((pin: PlacedPin) => {
    setDraft(null)
    setSelectedKey(pinKey(pin))
  }, [])

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
    window.setTimeout(() => setDraft(null), HOLD_MS)
  }

  const onMapClick = useCallback(() => setSelectedKey(null), [])

  // Escape closes the card when focus is inside this map view.
  useLayoutEffect(() => {
    const doc = root.current?.ownerDocument
    if (!doc) return
    const onKey = (event: KeyboardEvent): void => {
      const view = root.current?.closest('.saga-map')
      if (event.key !== 'Escape' || event.defaultPrevented || !selectedKey || !view || !view.contains(event.target as Node | null)) return
      setSelectedKey(null)
      event.preventDefault()
    }
    doc.addEventListener('keydown', onKey)
    return () => doc.removeEventListener('keydown', onKey)
  }, [selectedKey])

  const relook = async (pin: PlacedPin, change: LookChange): Promise<void> => {
    await write(pin.file, locate(pin, (index) => ({ kind: 'look', index, ...change })))
  }
  const remove = async (pin: PlacedPin): Promise<void> => {
    if (!(await host.confirmRemove(pin))) return
    if (await write(pin.file, locate(pin, (index) => ({ kind: 'remove', index })))) setSelectedKey(null)
  }
  const menus = {
    /** The right-click menu of the map (or the ContextMenu key on the stage): add a pin at that image point. */
    map: (at: Point, screen: Point): void => {
      const point = place(at.x, at.y)
      host.showMenu(screen, [{ title: 'Add pin here', icon: 'map-pin', onClick: () => void addPin(point) }])
    },
    /** The right-click menu of a pin (or the ContextMenu key on it): remove it. */
    pin: (pin: PlacedPin, screen: Point): void => host.showMenu(screen, [{ title: 'Remove pin', icon: 'trash', warning: true, onClick: () => void remove(pin) }])
  }
  const menusRef = useRef(menus)
  menusRef.current = menus
  const onMapMenu = useCallback((at: Point, screen: Point) => menusRef.current.map(at, screen), [])
  const onPinMenu = useCallback((pin: PlacedPin, screen: Point) => menusRef.current.pin(pin, screen), [])
  const hover = useCallback((event: ReactMouseEvent<HTMLElement>, pin: PlacedPin) => host.hoverNote(event.nativeEvent, event.currentTarget, pin.file), [host])

  return (
    <div ref={root} className="saga-map-stage-row">
      <PinSprite id={sprite} icons={icons} />
      <div className="saga-map-canvas-wrap">
        <div className="saga-map-canvas">
          <MapCanvas store={store} imageUrl={imageUrl} title={title} onMapClick={onMapClick} onMapMenu={onMapMenu} stageRef={setStage}>
            <PinLayer store={store} pins={visible} selectedKey={selectedKey} labels={labels} onSelect={select} onMoved={commitMove} onDragStart={closeCard} onHover={hover} onMenu={onPinMenu} />
            {draft && (draft.count === null || pins.length <= draft.count) ? <FixedGhost store={store} x={draft.x} y={draft.y} /> : null}
          </MapCanvas>
        </div>

        {layersPanel === 'floating' ? <LayersPanel pins={placed} layers={layers} onChange={setLayers} /> : null}
        <ZoomControls store={store} onFit={fitMap} />
        <Readout store={store} stage={stage} />
        {selected ? <PinPopover store={store} host={host} pin={selected} busy={busy} onClose={closeCard} onLook={(pin, change) => void relook(pin, change)} /> : null}
      </div>
      {layersPanel === 'sidebar' ? <LayersPanel pins={placed} layers={layers} onChange={setLayers} sidebar /> : null}
    </div>
  )
}
