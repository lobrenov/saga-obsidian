import { useEffect, useState } from 'react'
import { MapStage, type MapTool } from './MapStage'
import { SpriteContext } from './PinSprite'
import type { MapState } from './types'

type ImageSize = { width: number; height: number }

/** The pixel size of the image at `url`; null while loading, 'error' when it does not load. */
function useImageSize(url: string): ImageSize | 'error' | null {
  const [size, setSize] = useState<ImageSize | 'error' | null>(null)
  useEffect(() => {
    setSize(null)
    const image = new Image()
    image.onload = () => setSize({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => setSize('error')
    image.src = url
    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [url])
  return size
}

let spriteCount = 0

const cursor = (
  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 3 14 7-6 2-2 6z" />
  </svg>
)

function MapView({ state }: { state: Extract<MapState, { kind: 'map' }> }) {
  const size = useImageSize(state.imageUrl)
  const [tool, setTool] = useState<MapTool>('select')
  const [listOpen, setListOpen] = useState(false)

  let body
  if (size === 'error') body = <p className="saga-map-state">The map image could not be loaded.</p>
  else if (size === null) body = <p className="saga-map-state">Loading the map…</p>
  else
    body = (
      <MapStage
        key={state.imageUrl}
        host={state.host}
        title={state.title}
        imageUrl={state.imageUrl}
        size={size}
        pins={state.pins}
        tool={tool}
        setTool={setTool}
        listOpen={listOpen}
        labels={state.labels}
        layersOpen={state.layers}
      />
    )
  const ready = typeof size === 'object' && size !== null

  return (
    <>
      <header className="saga-map-header">
        <h2 className="saga-map-name">{state.title}</h2>
        <div role="group" aria-label="Map tool" className="saga-map-tools">
          <button type="button" aria-pressed={tool === 'select'} disabled={!ready} onClick={() => setTool('select')}>
            {cursor}
            Select
          </button>
          <button type="button" aria-pressed={tool === 'add'} disabled={!ready} onClick={() => setTool('add')}>
            Add pin
          </button>
        </div>
        <button type="button" aria-expanded={listOpen} disabled={!ready} onClick={() => setListOpen((open) => !open)}>
          Pins · {state.pins.length}
        </button>
      </header>
      <div className="saga-map-body">{body}</div>
    </>
  )
}

/** The Bases view's content: the chosen map with its pins, or why there is none. */
export function MapRoot({ state }: { state: MapState }) {
  const [sprite] = useState(() => `saga-map-sprite-${++spriteCount}`)
  return (
    <SpriteContext.Provider value={sprite}>
      <div className="saga-map">{state.kind === 'empty' ? <p className="saga-map-state">{state.message}</p> : <MapView state={state} />}</div>
    </SpriteContext.Provider>
  )
}
