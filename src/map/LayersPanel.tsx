import { useContext, useId } from 'react'
import type { ColorId } from '../shared/pins/look'
import { RENDERER_IDS, type RendererId } from '../shared/renderers/ids'
import { SpriteContext } from './PinSprite'
import { iconLabel, pinColor, pinGlyphId } from './pinStyles'
import type { PlacedPin } from './types'

export interface Layers {
  hiddenRenderers: ReadonlySet<RendererId>
  hiddenIcons: ReadonlySet<string>
}

export const NO_LAYERS: Layers = { hiddenRenderers: new Set(), hiddenIcons: new Set() }

export const isVisible = (pin: PlacedPin, layers: Layers): boolean => !layers.hiddenRenderers.has(pin.renderer) && !layers.hiddenIcons.has(pin.look.icon)

const PLURAL: Record<RendererId, string> = { character: 'Characters', location: 'Locations', faction: 'Factions', item: 'Items', map: 'Maps', calendar: 'Calendars', document: 'Documents' }

const toggled = <T,>(set: ReadonlySet<T>, value: T): Set<T> => {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

/** Layer toggles: by the renderer of the pinned note and by pin icon. Only what the map has is listed. Floats over the map, or with `sidebar` stands beside it. */
export function LayersPanel({ pins, layers, onChange, sidebar = false }: { pins: readonly PlacedPin[]; layers: Layers; onChange: (layers: Layers) => void; sidebar?: boolean }) {
  const heading = useId()
  const sprite = useContext(SpriteContext)
  const byRenderer = new Map<RendererId, { count: number; color: ColorId }>()
  const byIcon = new Map<string, number>()
  for (const pin of pins) {
    byRenderer.set(pin.renderer, { count: (byRenderer.get(pin.renderer)?.count ?? 0) + 1, color: pin.defaults.color })
    byIcon.set(pin.look.icon, (byIcon.get(pin.look.icon) ?? 0) + 1)
  }
  const renderers = RENDERER_IDS.filter((id) => byRenderer.has(id))
  const icons = [...byIcon.keys()].sort((a, b) => iconLabel(a).localeCompare(iconLabel(b)))

  return (
    <section aria-labelledby={heading} className={sidebar ? 'saga-map-layers saga-map-layers-sidebar' : 'saga-map-layers'}>
      <h2 id={heading} className="saga-map-layers-heading">
        Layers
      </h2>
      {renderers.length > 0 ? (
        <div role="group" aria-label="By renderer" className="saga-map-layer-group">
          {renderers.map((id) => (
            <label key={id} className="saga-map-layer-row">
              <input type="checkbox" checked={!layers.hiddenRenderers.has(id)} onChange={() => onChange({ ...layers, hiddenRenderers: toggled(layers.hiddenRenderers, id) })} />
              <span aria-hidden="true" className="saga-map-dot" style={{ background: pinColor(byRenderer.get(id)?.color ?? 'slate') }} />
              <span className="saga-map-layer-name">{PLURAL[id]}</span>
              <span className="saga-map-layer-count">{byRenderer.get(id)?.count}</span>
            </label>
          ))}
        </div>
      ) : null}
      {icons.length > 1 || icons.some((icon) => layers.hiddenIcons.has(icon)) ? (
        <div role="group" aria-label="By icon" className="saga-map-layer-group">
          <div className="saga-map-layer-rule" aria-hidden="true" />
          {icons.map((icon) => (
            <label key={icon} className="saga-map-layer-row">
              <input type="checkbox" checked={!layers.hiddenIcons.has(icon)} onChange={() => onChange({ ...layers, hiddenIcons: toggled(layers.hiddenIcons, icon) })} />
              <svg aria-hidden="true" className="saga-map-glyph" width="14" height="14" viewBox="0 0 24 24">
                <use href={`#${pinGlyphId(sprite, icon)}`} />
              </svg>
              <span className="saga-map-layer-name">{iconLabel(icon)}</span>
              <span className="saga-map-layer-count">{byIcon.get(icon)}</span>
            </label>
          ))}
        </div>
      ) : null}
    </section>
  )
}
