import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { formatDate, weekdayOf } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import { rendererDefs } from '../shared/renderers/definitions'
import { toExcerpt } from '../shared/markdown/excerpt'
import type { CalendarEntry } from './entries'
import { Glyph } from './Glyph'
import type { CalendarHost } from './host'

const WIDTH = 300
const GAP = 6
const EXCERPT_CHARS = 140

/** The date as the card shows it: a single day with its weekday, an end after a dash. */
function dateText(calendar: Calendar, entry: CalendarEntry): string {
  const { start, end } = entry
  if (!start) return ''
  const text = formatDate(calendar, start)
  if (end) return `${text} – ${formatDate(calendar, end)}`
  if ('year' in start && start.month !== undefined && start.day !== undefined) return `${calendar.weekdays[weekdayOf(calendar, start.year, start.month, start.day)]}, ${text}`
  return text
}

interface EntryCardProps {
  host: CalendarHost
  calendar: Calendar
  entry: CalendarEntry
  /** The `data-slot` of the element the card opened from. */
  slot: string
  onClose: () => void
}

/** The card of an entry: its renderer, the note's title as a link, its date, an excerpt and its issues; placed beside the element it opened from. */
export function EntryCard({ host, calendar, entry, slot, onClose }: EntryCardProps) {
  const id = useId()
  const root = useRef<HTMLElement>(null)
  const [excerpt, setExcerpt] = useState('')
  const date = dateText(calendar, entry)

  // Focus moves into the card and goes back to where it was when the card closes.
  useLayoutEffect(() => {
    const before = root.current?.ownerDocument.activeElement
    root.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
    return () => {
      // Focus returns only when it is still in the card (or nowhere), not when the user moved on, as to a navigation button.
      const now = root.current?.ownerDocument.activeElement
      const lost = !now || now === now.ownerDocument.body || root.current?.contains(now)
      if (lost && before?.instanceOf(HTMLElement) && before.isConnected) before.focus({ preventScroll: true })
    }
  }, [entry.file.path])

  // The card sits beside its anchor, on the side with room; in a narrow view the style puts it below the anchor, full width.
  useLayoutEffect(() => {
    const card = root.current
    const content = card?.parentElement
    if (!card || !content) return
    const place = (): void => {
      const anchor = [...content.querySelectorAll<HTMLElement>('[data-slot]')].find((el) => el.dataset['slot'] === slot)
      if (!anchor) return
      const at = anchor.getBoundingClientRect()
      const box = content.getBoundingClientRect()
      const side = at.left + at.width / 2 - box.left > box.width / 2 ? 'left' : 'right'
      const left = side === 'left' ? at.left - box.left - WIDTH - GAP : at.right - box.left + GAP
      card.dataset['side'] = side
      card.setCssProps({
        '--saga-calview-card-left': `${Math.min(Math.max(8, left), Math.max(8, box.width - WIDTH - 8))}px`,
        '--saga-calview-card-top': `${Math.max(0, at.top - box.top - 8)}px`,
        '--saga-calview-card-arrow': `${Math.max(8, at.height / 2 + 2)}px`,
        '--saga-calview-card-below': `${at.bottom - box.top + GAP}px`
      })
    }
    place()
    card.scrollIntoView({ block: 'nearest' })
    const observer = new ResizeObserver(place)
    observer.observe(content)
    return () => observer.disconnect()
  }, [slot])

  useEffect(() => {
    let live = true
    setExcerpt('')
    void host.excerpt(entry.file).then((text) => live && setExcerpt(toExcerpt(text, EXCERPT_CHARS)))
    return () => {
      live = false
    }
  }, [host, entry.file])

  return (
    <section
      ref={root}
      role="dialog"
      aria-labelledby={id}
      className="saga-calview-card"
      data-renderer={entry.renderer}
      onKeyDown={(event) => {
        if (event.key !== 'Tab' || !event.shiftKey || event.target !== root.current?.querySelector('button')) return
        const anchor = [...(root.current?.parentElement?.querySelectorAll<HTMLElement>('[data-slot]') ?? [])].find((el) => el.dataset['slot'] === slot)
        if (!anchor) return
        event.preventDefault()
        anchor.focus()
      }}
    >
      <span aria-hidden="true" className="saga-calview-card-arrow" />
      <button type="button" className="saga-calview-card-close clickable-icon" aria-label="Close" onClick={onClose}>
        <Glyph name="x" />
      </button>
      <p className="saga-calview-card-kind">
        <Glyph name={rendererDefs[entry.renderer].icon} />
        {rendererDefs[entry.renderer].label}
      </p>
      <h3 id={id} className="saga-calview-card-title">
        <a
          href={entry.file.path}
          className="internal-link"
          data-autofocus
          onClick={(event) => {
            event.preventDefault()
            host.openNote(entry.file, event.metaKey || event.ctrlKey)
          }}
          onMouseOver={(event) => host.hoverNote(event.nativeEvent, event.currentTarget, entry.file)}
        >
          {entry.title}
        </a>
      </h3>
      {date ? <p className="saga-calview-card-date">{date}</p> : null}
      {excerpt ? <p className="saga-calview-card-excerpt">{excerpt}</p> : null}
      {entry.issues.length > 0 ? (
        <ul className="saga-calview-card-issues" aria-label="Problems with this note">
          {entry.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
