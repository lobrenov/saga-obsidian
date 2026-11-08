import { useMemo } from 'react'
import { rendererDefs } from '../shared/renderers/definitions'
import { STYLE_LABELS, pinColor } from './pinStyles'
import { pinKey, type PlacedPin } from './types'

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

interface PinListProps {
  pins: readonly PlacedPin[]
  selectedKey: string | null
  onSelect: (pin: PlacedPin) => void
  onMove: (pin: PlacedPin) => void
  onAddAtCentre: () => void
}

/** Every pin of the map by title: the keyboard route to a pin, its card, and its move mode; and "Add pin at centre". */
export function PinList({ pins, selectedKey, onSelect, onMove, onAddAtCentre }: PinListProps) {
  const sorted = useMemo(() => [...pins].sort((a, b) => collator.compare(a.title, b.title) || a.index - b.index), [pins])
  return (
    <aside aria-label="Pins on this map" className="saga-map-pin-list">
      <div className="saga-map-pin-list-head">
        <h2>Pins · {pins.length}</h2>
        <button type="button" onClick={onAddAtCentre}>
          Add pin at centre
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="saga-map-pin-list-empty">No pins on this map yet.</p>
      ) : (
        <ul>
          {sorted.map((pin) => {
            const key = pinKey(pin)
            return (
              <li key={key} className="saga-map-pin-row">
                <button type="button" className="saga-map-pin-row-main" aria-current={key === selectedKey || undefined} onClick={() => onSelect(pin)}>
                  <span aria-hidden="true" className="saga-map-dot" style={{ background: pinColor(pin.style, pin.renderer) }} />
                  <span className="saga-map-pin-row-title">{pin.title}</span>
                  <span className="saga-map-pin-row-meta">{pin.style === 'auto' ? rendererDefs[pin.renderer].label : STYLE_LABELS[pin.style]}</span>
                </button>
                <button type="button" className="saga-map-pin-row-move" aria-label={`Move ${pin.title}`} onClick={() => onMove(pin)}>
                  Move
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
