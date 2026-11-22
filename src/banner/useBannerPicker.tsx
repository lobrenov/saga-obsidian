import { useEffect, useRef, useState } from 'react'
import { toNoteValue } from '../shared/renderers/values'
import { BannerPicker } from './BannerPicker'
import { useWrite } from './useWrite'

/** The image picker of a banner control: `popover` and `alert` to render, `open` for the trigger (give it `trigger`, and `aria-expanded={picking}`); a pick writes `key`, and closing returns the focus to the trigger, else to `fallback`. */
export function useBannerPicker(key: string) {
  const { write, error } = useWrite()
  const [picking, setPicking] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const fallback = useRef<HTMLDivElement>(null)
  const refocus = useRef(false)
  const was = useRef(false)

  useEffect(() => {
    if (was.current && !picking && refocus.current) (trigger.current?.isConnected ? trigger.current : fallback.current)?.focus()
    if (!picking) refocus.current = false
    was.current = picking
  }, [picking])

  const close = (focus: boolean): void => {
    refocus.current ||= focus
    setPicking(false)
  }
  const popover = picking ? (
    <BannerPicker
      onClose={close}
      onPick={(target) => {
        close(true)
        void write(key, toNoteValue({ target, embed: false }))
      }}
    />
  ) : null
  const alert = error ? (
    <p role="alert" className="saga-banner-error">
      {error}
    </p>
  ) : null
  return { write, picking, open: () => setPicking(true), trigger, fallback, popover, alert }
}
