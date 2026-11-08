import { useId } from 'react'
import { RENDERER_IDS, type RendererId } from '../shared/renderers/ids'
import { PIN_STYLES, type PinStyle } from '../shared/schemas/pins'
import { PIN_LIGHT, STYLE_GLYPHS, STYLE_LABELS, pinColor } from './pinStyles'
import type { PlacedPin } from './types'

export interface Layers {
  hiddenRenderers: ReadonlySet<RendererId>
  hiddenStyles: ReadonlySet<PinStyle>
}

export const NO_LAYERS: Layers = { hiddenRenderers: new Set(), hiddenStyles: new Set() }

export const isVisible = (pin: PlacedPin, layers: Layers): boolean => !layers.hiddenRenderers.has(pin.renderer) && !layers.hiddenStyles.has(pin.style)

const PLURAL: Record<RendererId, string> = { character: 'Characters', location: 'Locations', faction: 'Factions', item: 'Items', map: 'Maps', document: 'Documents' }

const toggled = <T,>(set: ReadonlySet<T>, value: T): Set<T> => {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

/** Layer toggles: by the renderer of the pinned note and by pin style. Only what the map has is listed. */
export function LayersPanel({ pins, layers, onChange }: { pins: readonly PlacedPin[]; layers: Layers; onChange: (layers: Layers) => void }) {
  const heading = useId()
  const byRenderer = new Map<RendererId, number>()
  const byStyle = new Map<PinStyle, number>()
  for (const pin of pins) {
    byRenderer.set(pin.renderer, (byRenderer.get(pin.renderer) ?? 0) + 1)
    byStyle.set(pin.style, (byStyle.get(pin.style) ?? 0) + 1)
  }
  const renderers = RENDERER_IDS.filter((id) => byRenderer.has(id))
  const styleList = PIN_STYLES.filter((style) => byStyle.has(style))

  return (
    <section aria-labelledby={heading} className="saga-map-layers">
      <h2 id={heading} className="saga-map-layers-heading">
        Layers
      </h2>
      {renderers.length > 0 ? (
        <div role="group" aria-label="By renderer" className="saga-map-layer-group">
          {renderers.map((id) => (
            <label key={id} className="saga-map-layer-row">
              <input type="checkbox" checked={!layers.hiddenRenderers.has(id)} onChange={() => onChange({ ...layers, hiddenRenderers: toggled(layers.hiddenRenderers, id) })} />
              <span aria-hidden="true" className="saga-map-dot" style={{ background: pinColor(id) }} />
              <span className="saga-map-layer-name">{PLURAL[id]}</span>
              <span className="saga-map-layer-count">{byRenderer.get(id)}</span>
            </label>
          ))}
        </div>
      ) : null}
      {styleList.length > 1 || (styleList.length === 1 && styleList[0] !== 'auto') ? (
        <div role="group" aria-label="By style" className="saga-map-layer-group">
          <div className="saga-map-layer-rule" aria-hidden="true" />
          {styleList.map((style) => (
            <label key={style} className="saga-map-layer-row">
              <input type="checkbox" checked={!layers.hiddenStyles.has(style)} onChange={() => onChange({ ...layers, hiddenStyles: toggled(layers.hiddenStyles, style) })} />
              <svg aria-hidden="true" className="saga-map-glyph" width="14" height="14" viewBox="8 8 16 16" fill="currentColor" dangerouslySetInnerHTML={{ __html: STYLE_GLYPHS[style].replaceAll(PIN_LIGHT, 'currentColor') }} />
              <span className="saga-map-layer-name">{style === 'auto' ? 'Auto style' : STYLE_LABELS[style]}</span>
              <span className="saga-map-layer-count">{byStyle.get(style)}</span>
            </label>
          ))}
        </div>
      ) : null}
    </section>
  )
}
