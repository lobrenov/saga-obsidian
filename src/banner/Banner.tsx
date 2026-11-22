import { useEffect, useRef, useState } from 'react'
import type { TFile } from 'obsidian'
import { useHeader } from '../header/env'
import { Icon } from '../header/Icon'
import { resourceUrl } from '../obsidian/vault'
import { BANNER_Y_KEY, clamp, type Banner as BannerData } from '../shared/renderers/banner'
import { leafOf } from './dom'
import { useBannerPicker } from './useBannerPicker'
import { removeBanner } from './useWrite'

export interface BannerProps {
  banner: BannerData
  /** The file `banner.link` resolves to, or null when it does not resolve. */
  image: TFile | null
  repositioning: boolean
  onRepositioningChange: (on: boolean) => void
}

/** A touch that moves less than this many pixels is a tap. */
const TAP_SLOP = 4

/** The banner image with hover controls (Reposition, Change, Remove) and the reposition mode. */
export function Banner({ banner, image, repositioning, onRepositioningChange }: BannerProps) {
  const { env } = useHeader()
  const { write, picking, open, trigger, fallback, popover, alert } = useBannerPicker(banner.key)
  const [tapped, setTapped] = useState(false)
  /** The `src` that failed to load. */
  const [failed, setFailed] = useState<string | null>(null)
  /** The position while repositioning, and after Save until the note delivers it. */
  const [draft, setDraft] = useState<number | null>(null)
  const [seenY, setSeenY] = useState(banner.y)
  const drag = useRef<{ startY: number; startPosition: number } | null>(null)
  const tap = useRef<{ x: number; y: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const imageEl = useRef<HTMLDivElement>(null)
  const position = draft ?? banner.y
  const src = image ? resourceUrl(env.app, image) : null
  const missing = src === null || failed === src
  if (seenY !== banner.y) {
    setSeenY(banner.y)
    if (!repositioning) setDraft(null)
  }

  useEffect(() => {
    if (!repositioning || !root.current) return
    const el = root.current
    const leaf = leafOf(el)
    imageEl.current?.focus()
    // Only an Esc aimed into this leaf cancels; the listener sits on the banner's own document (a popout window has its own).
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !leaf.contains(event.target as Node | null)) return
      event.preventDefault()
      setDraft(null)
      onRepositioningChange(false)
    }
    el.ownerDocument.addEventListener('keydown', onKey)
    return () => el.ownerDocument.removeEventListener('keydown', onKey)
  }, [repositioning, onRepositioningChange])

  useEffect(() => {
    if (!tapped || !root.current) return
    const el = root.current
    const onDown = (event: PointerEvent): void => {
      if (!el.contains(event.target as Node | null)) setTapped(false)
    }
    el.ownerDocument.addEventListener('pointerdown', onDown)
    return () => el.ownerDocument.removeEventListener('pointerdown', onDown)
  }, [tapped])

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
    <div
      ref={root}
      className="saga-banner"
      data-repositioning={repositioning || undefined}
      data-tapped={tapped || undefined}
      data-picking={picking || undefined}
      data-missing={missing || undefined}
    >
      <div
        ref={imageEl}
        className="saga-banner-image"
        tabIndex={0}
        role={repositioning ? 'slider' : 'group'}
        aria-label={repositioning ? 'Banner position' : 'Banner'}
        {...(repositioning ? { 'aria-orientation': 'vertical' as const, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': position } : {})}
        onKeyDown={(event) => {
          if (!repositioning || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
          event.preventDefault()
          const step = (event.shiftKey ? 10 : 1) * (event.key === 'ArrowUp' ? 1 : -1)
          setDraft(clamp(position + step))
        }}
        onPointerDown={(event) => {
          tap.current = { x: event.clientX, y: event.clientY }
          if (!repositioning) return
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { startY: event.clientY, startPosition: position }
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          drag.current = null
          const start = tap.current
          tap.current = null
          if (event.pointerType === 'touch' && !repositioning && start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < TAP_SLOP) setTapped(!tapped)
        }}
        onPointerCancel={() => (tap.current = null)}
        onLostPointerCapture={() => (drag.current = null)}
      >
        {src ? <img src={src} alt="" draggable={false} hidden={missing} style={{ objectPosition: `50% ${position}%` }} onError={() => setFailed(src)} /> : null}
      </div>
      {missing ? <p className="saga-banner-missing">Image not found: {banner.link?.target}</p> : null}
      <div className="saga-banner-actions">
        {popover}
        {alert}
        {repositioning ? (
          <div ref={fallback} tabIndex={-1} className="saga-banner-controls">
            <span role="status" className="saga-banner-hint">
              Drag the image to reposition (or use the arrow keys)
            </span>
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
          <div ref={fallback} tabIndex={-1} className="saga-banner-controls">
            {missing ? null : (
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
            )}
            <button ref={trigger} type="button" className="saga-banner-control" aria-expanded={picking} onClick={open}>
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
