import { useMemo, useRef, useState } from 'react'
import { addMonths, addYears, dayNumber, daysInYear, formatDate, type CalendarDate } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import { Chips } from './Chips'
import { EntryCard } from './EntryCard'
import type { CalendarEntry } from './entries'
import { FeedDisplay } from './FeedDisplay'
import { Glyph } from './Glyph'
import { MonthGrid, type Selection } from './MonthGrid'
import { NoteLink } from './NoteLink'
import { opening } from './opening'
import { place, type Placed } from './placement'
import { TimelineDisplay } from './TimelineDisplay'
import type { CalendarState, Range } from './types'
import { YearGrid, type DayEntries } from './YearGrid'
import { useHiddenLabel } from '../ui/hiddenLabel'
import { entryNoun } from './entryActions'
import { HOLD_MS, HOLD_SLOP_PX } from '../map/touch'

type Ready = Extract<CalendarState, { kind: 'calendar' }>

/** What a month or year entry is dated to, for its chip; a month names its year when that is not the visible one. */
const looseLabel = (calendar: Calendar, start: CalendarDate | undefined, visibleYear: number): string => {
  if (!start || !('year' in start)) return ''
  if (start.month === undefined) return formatDate(calendar, { year: start.year })
  return start.year === visibleYear ? (calendar.months[start.month - 1]?.name ?? '') : formatDate(calendar, { year: start.year, month: start.month })
}

const overlaps = (placed: Placed, from: number, to: number): boolean => placed.from <= to && placed.to >= from

/** The Calendar display: the range's title with the calendar's link, navigation and the Month/Year toggle, the entries with no day set, and the grid. */
function CalendarDisplay({ state }: { state: Ready }) {
  const { calendar, entries, host, file } = state
  const [rangeId, rangeLabel] = useHiddenLabel('Range')
  // The range the toggle chose, until the `opens` option shows it.
  const [pending, setPending] = useState<Range | null>(null)
  const [at, setAt] = useState(() => opening(calendar, entries))
  const [selected, setSelected] = useState<Selection | null>(null)
  const placement = useMemo(() => place(calendar, entries), [calendar, entries])
  const range = pending ?? state.opens
  const month = Math.min(at.month, calendar.months.length)
  if (pending !== null && pending === state.opens) setPending(null)

  const step = (n: number, from?: HTMLElement): void => {
    setAt((current) => {
      const here = { year: current.year, month: Math.min(current.month, calendar.months.length) }
      return range === 'month' ? addMonths(calendar, here, n) : { year: addYears(here.year, n), month: here.month }
    })
    setSelected(null)
    from?.focus()
  }
  const choose = (next: Range): void => {
    setPending(next)
    setSelected(null)
    state.setOption('opens', next)
  }

  const from = range === 'month' ? dayNumber(calendar, at.year, month, 1) : dayNumber(calendar, at.year, 1, 1)
  const to = from + (range === 'month' ? (calendar.months[month - 1]?.days ?? 1) : daysInYear(calendar)) - 1
  const loose = placement.loose.filter((placed) => overlaps(placed, from, to)).map(({ entry }) => ({ entry, text: looseLabel(calendar, entry.start, at.year) }))
  const unplaced = placement.unplaced.map((entry) => ({ entry, text: '' }))
  const byDay = useMemo<DayEntries>(() => {
    const map = new Map<number, { entry: CalendarEntry; start: boolean }[]>()
    if (range !== 'year') return map
    for (const placed of placement.days)
      for (let n = Math.max(placed.from, from); n <= Math.min(placed.to, to); n++) map.set(n, [...(map.get(n) ?? []), { entry: placed.entry, start: n === placed.from }])
    return map
  }, [placement, range, from, to])
  const card = selected ? entries.find((entry) => entry.file.path === selected.path) : undefined
  const onSelect = (entry: CalendarEntry, slot: string): void => setSelected(selected?.slot === slot ? null : { path: entry.file.path, slot })
  const yearText = formatDate(calendar, { year: at.year })
  const unit = range === 'month' ? 'month' : 'year'

  return (
    <div
      className="saga-calview-display"
      onKeyDown={(event) => {
        if (event.key === 'PageUp' || event.key === 'PageDown') {
          event.preventDefault()
          step(event.key === 'PageUp' ? -1 : 1)
        } else if (event.key === 'Escape' && selected) {
          event.stopPropagation()
          setSelected(null)
        }
      }}
    >
      <header className="saga-calview-header">
        <div className="saga-calview-heading">
          <h2 className="saga-calview-title">
            {range === 'month' ? <>{calendar.months[month - 1]?.name} </> : null}
            <span className={range === 'month' ? 'saga-calview-title-year' : undefined}>{yearText}</span>
          </h2>
          <span className="saga-calview-on">
            on{' '}
            <NoteLink host={host} file={file}>
              {state.title}
            </NoteLink>
          </span>
        </div>
        <div className="saga-calview-nav">
          <button type="button" className="saga-calview-step" aria-label={`Previous ${unit}`} onClick={(event) => step(-1, event.currentTarget)}>
            <Glyph name="chevron-left" />
          </button>
          <button type="button" className="saga-calview-step" aria-label={`Next ${unit}`} onClick={(event) => step(1, event.currentTarget)}>
            <Glyph name="chevron-right" />
          </button>
        </div>
        <div role="group" aria-labelledby={rangeId} className="saga-calview-range">
          {rangeLabel}
          <button type="button" aria-pressed={range === 'month'} onClick={() => choose('month')}>
            Month
          </button>
          <button type="button" aria-pressed={range === 'year'} onClick={() => choose('year')}>
            Year
          </button>
        </div>
      </header>
      <div className="saga-calview-body">
        <div
          className="saga-calview-content"
          onClick={(event) => {
            if (selected && !(event.target as Element).closest('[data-slot], .saga-calview-bar, .saga-calview-card')) setSelected(null)
          }}
        >
          <Chips label="No day set" items={loose} selected={selected} onSelect={onSelect} />
          <Chips label="Date problem" items={unplaced} selected={selected} onSelect={onSelect} />
          {range === 'month' ? (
            <MonthGrid calendar={calendar} host={host} year={at.year} month={month} days={placement.days} selected={selected} onSelect={onSelect} />
          ) : (
            <YearGrid calendar={calendar} host={host} year={at.year} byDay={byDay} selected={selected} onSelect={onSelect} />
          )}
          {card && selected ? <EntryCard key={selected.slot} host={host} calendar={calendar} entry={card} slot={selected.slot} onClose={() => setSelected(null)} /> : null}
        </div>
      </div>
    </div>
  )
}

/** The Bases view's content: the chosen display of the calendar, or why there is no calendar. */
export function CalendarRoot({ state }: { state: CalendarState }) {
  const [problemsId, problemsLabel] = useHiddenLabel('Problems with the calendar')
  let body
  if (state.kind === 'empty')
    body = (
      <div className="saga-calview-state">
        <p>
          {state.link && state.message.startsWith(state.link.file.basename) ? (
            <>
              <NoteLink host={state.link.host} file={state.link.file}>
                {state.link.file.basename}
              </NoteLink>
              {state.message.slice(state.link.file.basename.length)}
            </>
          ) : (
            state.message
          )}
        </p>
        {state.issues.length > 0 ? problemsLabel : null}
        {state.issues.length > 0 ? (
          <ul aria-labelledby={problemsId}>
            {state.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  else if (state.display === 'calendar') body = <CalendarDisplay key={state.file.path} state={state} />
  else if (state.display === 'feed') body = <FeedDisplay key={state.file.path} state={state} />
  else body = <TimelineDisplay key={state.file.path} state={state} />
  // A right-click, the menu key or a held touch on an element of one entry offers to edit or delete its note.
  const hold = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null)
  const openMenu = (el: HTMLElement, at: { x: number; y: number } | null): boolean => {
    if (state.kind !== 'calendar') return false
    const entry = state.entries.find((candidate) => candidate.file.path === el.dataset['entry'])
    if (!entry) return false
    const noun = entryNoun(entry)
    const box = el.getBoundingClientRect()
    state.host.showMenu(at ?? { x: box.left, y: box.bottom }, [
      { title: `Edit ${noun}…`, icon: 'pencil', onClick: () => state.host.editEntry(entry) },
      { title: `Delete ${noun}`, icon: 'trash-2', warning: true, onClick: () => state.host.deleteEntry(entry) }
    ])
    return true
  }
  const entryAt = (target: EventTarget | null): HTMLElement | null => (target as Element | null)?.closest<HTMLElement>('[data-entry]') ?? null
  const stopHold = (): void => {
    if (hold.current) window.clearTimeout(hold.current.timer)
  }
  return (
    <div
      className="saga-calview"
      onContextMenu={(event) => {
        const el = entryAt(event.target)
        if (!el) return
        event.preventDefault()
        stopHold()
        // A held touch has opened the menu already; the browser's own contextmenu for it adds none.
        if (hold.current?.fired) return
        openMenu(el, event.clientX || event.clientY ? { x: event.clientX, y: event.clientY } : null)
      }}
      onPointerDown={(event) => {
        stopHold()
        hold.current = null
        const el = entryAt(event.target)
        if (event.pointerType !== 'touch' || !el) return
        const { clientX: x, clientY: y } = event
        const timer = window.setTimeout(() => {
          if (hold.current) hold.current.fired = openMenu(el, { x, y })
        }, HOLD_MS)
        hold.current = { timer, x, y, fired: false }
      }}
      onPointerMove={(event) => {
        if (hold.current && Math.hypot(event.clientX - hold.current.x, event.clientY - hold.current.y) >= HOLD_SLOP_PX) stopHold()
      }}
      onPointerUp={stopHold}
      onPointerCancel={stopHold}
      onClickCapture={(event) => {
        // The click that ends a held touch does not also open the card.
        if (!hold.current?.fired) return
        event.preventDefault()
        event.stopPropagation()
        hold.current = null
      }}
    >
      {body}
    </div>
  )
}
