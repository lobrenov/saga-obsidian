import { useEffect, useState } from 'react'
import { useViewport, type ViewportStore } from './viewportStore'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** Zoom in, zoom out and fit. */
export function ZoomControls({ store, onFit }: { store: ViewportStore; onFit: () => void }) {
  return (
    <div role="group" aria-label="Zoom" className="saga-map-zoom">
      <button type="button" aria-label="Zoom in" onClick={() => store.zoomStep(1)}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" {...stroke}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => store.zoomStep(-1)}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" {...stroke}>
          <path d="M5 12h14" />
        </svg>
      </button>
      <button type="button" aria-label="Fit map" onClick={onFit}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" {...stroke}>
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      </button>
    </div>
  )
}

/** The pointer's position over `stage` in image pixels and the zoom level (0 is the image's native size). */
export function Readout({ store, stage }: { store: ViewportStore; stage: HTMLElement | null }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const zoom = useViewport(store, (v) => Math.round(v.zoom * 100) / 100)
  useEffect(() => {
    if (!stage) return undefined
    const move = (event: PointerEvent): void => {
      const box = stage.getBoundingClientRect()
      const p = store.toImage(event.clientX - box.left, event.clientY - box.top)
      setAt({ x: Math.round(p.x), y: Math.round(p.y) })
    }
    stage.addEventListener('pointermove', move)
    return () => stage.removeEventListener('pointermove', move)
  }, [store, stage])
  return (
    <p className="saga-map-readout">
      {at ? `x ${at.x} · y ${at.y}` : 'x – · y –'} · zoom {zoom}
    </p>
  )
}
