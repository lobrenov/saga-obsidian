import { useLayoutEffect, useReducer } from 'react'
import { frontmatterOf } from '../obsidian/vault'
import { compareDates, formatDate, readDate } from '../shared/calendars/dates'
import { loreOf } from './CalendarLayout'
import { useHeader } from './env'
import { Icon } from './Icon'
import { noteCalendar } from './noteCalendar'

const RELOAD_DELAY_MS = 250

/** The Lore notes of this note's calendar that come just before and just after it, by date; they follow the vault as notes change, are renamed or deleted. */
export function LoreFooter() {
  const { env, file, config, renderer } = useHeader()
  const { app } = env
  const [, reload] = useReducer((n: number) => n + 1, 0)

  useLayoutEffect(() => {
    let timer: number | undefined
    const rescan = (): void => {
      window.clearTimeout(timer)
      timer = window.setTimeout(reload, RELOAD_DELAY_MS)
    }
    const refs = [app.metadataCache.on('changed', rescan), app.metadataCache.on('deleted', rescan)]
    const renamed = app.vault.on('rename', rescan)
    return () => {
      window.clearTimeout(timer)
      refs.forEach((ref) => app.metadataCache.offref(ref))
      app.vault.offref(renamed)
    }
  }, [app])

  const frontmatter = frontmatterOf(app, file)
  const { calendar, file: calendarFile, key } = noteCalendar(app, file, config, renderer, frontmatter)
  const here = readDate(frontmatter, '').value
  if (!calendar || !calendarFile || !here) return null

  const notes = [...loreOf(app, calendarFile, key).filter((note) => note.path !== file.path), { path: file.path, start: here, end: undefined }].sort(
    (a, b) => compareDates(calendar, a.start, b.start) || a.path.localeCompare(b.path)
  )
  const at = notes.findIndex((note) => note.path === file.path)
  const neighbour = (note: (typeof notes)[number] | undefined, direction: 'before' | 'after') =>
    note ? (
      <a
        className="saga-lore-neighbour"
        data-direction={direction}
        href={`#${note.path}`}
        onClick={(event) => {
          event.preventDefault()
          env.openLink(note.path, file.path, event)
        }}
        onMouseOver={(event) => env.hover(event.nativeEvent, event.currentTarget, note.path, file.path)}
      >
        {direction === 'before' ? <Icon name="chevron-left" /> : null}
        <span>
          {app.vault.getFileByPath(note.path)?.basename ?? note.path} <span className="saga-lore-neighbour-date">· {formatDate(calendar, note.start)}</span>
        </span>
        {direction === 'after' ? <Icon name="chevron-right" /> : null}
      </a>
    ) : (
      <span className="saga-lore-none">{direction === 'before' ? 'Nothing earlier' : 'Nothing later'}</span>
    )

  return (
    <nav className="saga-lore-footer" aria-label="Neighbouring lore">
      {neighbour(notes[at - 1], 'before')}
      {neighbour(notes[at + 1], 'after')}
    </nav>
  )
}
