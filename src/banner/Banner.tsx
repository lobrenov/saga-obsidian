import { useEffect, useRef, useState } from 'react'
import type { TFile } from 'obsidian'
import { useHeader } from '../header/env'
import { Icon } from '../header/Icon'
import { resourceUrl } from '../obsidian/vault'
import { BANNER_Y_KEY, type Banner as BannerData } from '../shared/renderers/banner'
import { toNoteValue } from '../shared/renderers/values'
import { BannerPicker } from './BannerPicker'
import { removeBanner, useWrite } from './useWrite'

export interface BannerProps {
  banner: BannerData
  /** The file `banner.link` resolves to, or null when it does not resolve. */
  image: TFile | null
  repositioning: boolean
  onRepositioningChange: (on: boolean) => void
}

const clamp = (y: number): number => Math.round(Math.min(100, Math.max(0, y)))

/** The banner image with hover controls (Reposition, Change, Remove) and the reposition mode. */
export function Banner({ banner, image, repositioning, onRepositioningChange }: BannerProps) {
  const { env } = useHeader()
  const { write, error } = useWrite()
  const [picking, setPicking] = useState(false)
  const [tapped, setTapped] = useState(false)
  /** The position while repositioning, and after Save until the note delivers it. */
  const [draft, setDraft] = useState<number | null>(null)
  const [seenY, setSeenY] = useState(banner.y)
  const drag = useRef<{ startY: number; startPosition: number } | null>(null)
  const position = draft ?? banner.y
  if (seenY !== banner.y) {
    setSeenY(banner.y)
    if (!repositioning) setDraft(null)
  }

  useEffect(() => {
    if (!repositioning) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setDraft(null)
      onRepositioningChange(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [repositioning, onRepositioningChange])

  const move = (event: React.PointerEvent<HTMLDivElement>): void => {
    const start = drag.current
    const img = event.currentTarget.querySelector('img')
    if (!start || !img || !img.naturalWidth) return
    const box = event.currentTarget.getBoundingClientRect()
    const overflow = img.naturalHeight * Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight) - box.height
    if (overflow <= 0) return
    setDraft(clamp(start.startPosition - ((event.clientY - start.startY) / overflow) * 100))
  }

  const save = async (): Promise<void> => {
    if (draft === null || draft === banner.y || (await write(BANNER_Y_KEY, draft))) onRepositioningChange(false)
  }

  return (
    <div className="saga-banner" data-repositioning={repositioning || undefined} data-tapped={tapped || undefined} data-picking={picking || undefined}>
      <div
        className="saga-banner-image"
        onPointerDown={(event) => {
          if (!repositioning) return
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { startY: event.clientY, startPosition: position }
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          drag.current = null
          if (event.pointerType === 'touch' && !repositioning) setTapped(!tapped)
        }}
        onLostPointerCapture={() => (drag.current = null)}
      >
        {image ? <img src={resourceUrl(env.app, image)} alt="" draggable={false} style={{ objectPosition: `50% ${position}%` }} /> : null}
      </div>
      <div className="saga-banner-actions">
        {picking ? (
          <BannerPicker
            onClose={() => setPicking(false)}
            onPick={(target) => {
              setPicking(false)
              void write(banner.key, toNoteValue({ target, embed: false }))
            }}
          />
        ) : null}
        {error ? <p role="alert" className="saga-banner-error">{error}</p> : null}
        {repositioning ? (
          <div className="saga-banner-controls">
            <span className="saga-banner-hint">Drag the image to reposition</span>
            <button type="button" className="saga-banner-control mod-cta" onClick={() => void save()}>
              Save position
            </button>
            <button
              type="button"
              className="saga-banner-control"
              onClick={() => {
                setDraft(null)
                onRepositioningChange(false)
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="saga-banner-controls">
            <button
              type="button"
              className="saga-banner-control"
              onClick={() => {
                setDraft(null)
                onRepositioningChange(true)
              }}
            >
              <Icon name="move-vertical" />
              Reposition
            </button>
            <button type="button" className="saga-banner-control" onClick={() => setPicking(true)}>
              <Icon name="image" />
              Change banner
            </button>
            {banner.removable ? (
              <button type="button" className="saga-banner-control mod-warning" onClick={() => void removeBanner(write, banner.key)}>
                <Icon name="trash-2" />
                Remove
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
