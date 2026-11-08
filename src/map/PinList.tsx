import { useMemo } from 'react'
import { rendererDefs } from '../shared/renderers/definitions'
import { STYLE_LABELS, pinColor } from './pinStyles'
import { pinKey, type PlacedPin } from './types'

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

interface PinListProps {
  pins: readonly PlacedPin[]
  selectedKey: string | null
  onSelect: (pin: PlacedPin) => void
}

/** Every pin of the map by title: the keyboard route to a pin and its card. */
export function PinList({ pins, selectedKey, onSelect }: PinListProps) {
  const sorted = useMemo(() => [...pins].sort((a, b) => collator.compare(a.title, b.title) || a.index - b.index), [pins])
  return (
    <aside aria-label="Pins on this map" className="saga-map-pin-list">
      <div className="saga-map-pin-list-head">
        <h2>Pins · {pins.length}</h2>
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
                  <span aria-hidden="true" className="saga-map-dot" style={{ background: pinColor(pin.renderer) }} />
                  <span className="saga-map-pin-row-title">{pin.title}</span>
                  <span className="saga-map-pin-row-meta">{pin.style === 'auto' ? rendererDefs[pin.renderer].label : STYLE_LABELS[pin.style]}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
