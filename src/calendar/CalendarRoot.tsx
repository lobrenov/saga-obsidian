import { useId, useMemo, useRef, useState } from 'react'
import { addMonths, addYears, compareDates, dayNumber, daysInYear, formatDate, type CalendarDate } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import { EntryCard } from './EntryCard'
import type { CalendarEntry } from './entries'
import { Glyph } from './Glyph'
import { MonthGrid, type Selection } from './MonthGrid'
import { place, type Placed } from './placement'
import type { CalendarState, Range } from './types'
import { YearGrid } from './YearGrid'

type Ready = Extract<CalendarState, { kind: 'calendar' }>

/** The month the display opens on: the earliest dated entry's, else month 1 of year 1. */
function opening(calendar: Calendar, entries: readonly CalendarEntry[]): { year: number; month: number } {
  const dated = entries.flatMap(({ start }) => (start && 'year' in start ? [start] : []))
  const first = dated.sort((a, b) => compareDates(calendar, a, b))[0]
  return first && 'year' in first ? { year: first.year, month: first.month ?? 1 } : { year: 1, month: 1 }
}

/** What a month or year entry is dated to, for its chip. */
const looseLabel = (calendar: Calendar, start: CalendarDate | undefined): string => {
  if (!start || !('year' in start)) return ''
  return start.month === undefined ? formatDate(calendar, { year: start.year }) : (calendar.months[start.month - 1]?.name ?? '')
}

const overlaps = (placed: Placed, from: number, to: number): boolean => placed.from <= to && placed.to >= from

interface ChipsProps {
  label: string
  items: { entry: CalendarEntry; text: string }[]
  selected: Selection | null
  onSelect: (entry: CalendarEntry, slot: string) => void
}

/** A labelled row of entries as chips. */
function Chips({ label, items, selected, onSelect }: ChipsProps) {
  const id = useId()
  if (items.length === 0) return null
  return (
    <div role="group" aria-labelledby={id} className="saga-calview-chips">
      <span id={id} className="saga-calview-chips-label">
        {label}
      </span>
      {items.map(({ entry, text }) => {
        const slot = `${label}|${entry.file.path}`
        return (
          <button
            key={entry.file.path}
            type="button"
            className="saga-calview-chip"
            aria-haspopup="dialog"
            aria-expanded={selected?.slot === slot}
            data-slot={slot}
            data-renderer={entry.renderer}
            data-problem={entry.start === undefined || undefined}
            data-selected={selected?.path === entry.file.path || undefined}
            onClick={() => onSelect(entry, slot)}
          >
            {text ? <span className="saga-calview-chip-when">{text}</span> : null}
            {entry.title}
          </button>
        )
      })}
    </div>
  )
}

/** The Calendar display: the range's title with the calendar's link, navigation and the Month/Year toggle, the entries with no day set, and the grid. */
function CalendarDisplay({ state }: { state: Ready }) {
  const { calendar, entries, host, file } = state
  // The range the toggle chose, kept until the `opens` option changes under it.
  const [chosen, setChosen] = useState<{ opens: Range; range: Range } | null>(null)
  const [moved, setMoved] = useState<{ year: number; month: number } | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  const content = useRef<HTMLDivElement>(null)
  const placement = useMemo(() => place(calendar, entries), [calendar, entries])
  const range = chosen?.opens === state.opens ? chosen.range : state.opens
  const at = moved ?? opening(calendar, entries)

  const step = (n: number): void => {
    setMoved((current) => {
      const from = current ?? opening(calendar, entries)
      return range === 'month' ? addMonths(calendar, from, n) : { year: addYears(from.year, n), month: from.month }
    })
    setSelected(null)
  }
  const choose = (next: Range): void => {
    setChosen({ opens: state.opens, range: next })
    setSelected(null)
    state.setOption('opens', next)
  }

  const from = range === 'month' ? dayNumber(calendar, at.year, at.month, 1) : dayNumber(calendar, at.year, 1, 1)
  const to = from + (range === 'month' ? (calendar.months[at.month - 1]?.days ?? 1) : daysInYear(calendar)) - 1
  const loose = placement.loose.filter((placed) => overlaps(placed, from, to)).map(({ entry }) => ({ entry, text: looseLabel(calendar, entry.start) }))
  const unplaced = placement.unplaced.map((entry) => ({ entry, text: '' }))
  const card = selected ? entries.find((entry) => entry.file.path === selected.path) : undefined
  const onSelect = (entry: CalendarEntry, slot: string): void => setSelected(selected?.slot === slot ? null : { path: entry.file.path, slot })
  const yearText = formatDate(calendar, { year: at.year })
  const unit = range === 'month' ? 'month' : 'year'

  return (
    <div
      className="saga-calview-display"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !selected) return
        event.stopPropagation()
        setSelected(null)
      }}
    >
      <header className="saga-calview-header">
        <div className="saga-calview-heading">
          <h2 className="saga-calview-title">
            {range === 'month' ? <>{calendar.months[at.month - 1]?.name} </> : null}
            <span className={range === 'month' ? 'saga-calview-title-year' : undefined}>{yearText}</span>
          </h2>
          <span className="saga-calview-on">
            on{' '}
            <a
              href={file.path}
              className="internal-link"
              onClick={(event) => {
                event.preventDefault()
                host.openNote(file, event.metaKey || event.ctrlKey)
              }}
              onMouseOver={(event) => host.hoverNote(event.nativeEvent, event.currentTarget, file)}
            >
              {state.title}
            </a>
          </span>
        </div>
        <div className="saga-calview-nav">
          <button type="button" className="saga-calview-step" aria-label={`Previous ${unit}`} onClick={() => step(-1)}>
            <Glyph name="chevron-left" />
          </button>
          <button type="button" className="saga-calview-step" aria-label={`Next ${unit}`} onClick={() => step(1)}>
            <Glyph name="chevron-right" />
          </button>
        </div>
        <div role="group" aria-label="Range" className="saga-calview-range">
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
          ref={content}
          className="saga-calview-content"
          onClick={(event) => {
            if (selected && !(event.target as Element).closest('[data-slot], .saga-calview-bar, .saga-calview-card')) setSelected(null)
          }}
        >
          <Chips label="No day set" items={loose} selected={selected} onSelect={onSelect} />
          <Chips label="Date problem" items={unplaced} selected={selected} onSelect={onSelect} />
          {range === 'month' ? (
            <MonthGrid calendar={calendar} year={at.year} month={at.month} days={placement.days} selected={selected} onSelect={onSelect} />
          ) : (
            <YearGrid calendar={calendar} host={host} year={at.year} days={placement.days} selected={selected} onSelect={onSelect} />
          )}
          {card && selected ? <EntryCard key={selected.slot} host={host} calendar={calendar} entry={card} slot={selected.slot} onClose={() => setSelected(null)} /> : null}
        </div>
      </div>
    </div>
  )
}

/** The Bases view's content: the chosen display of the calendar, or why there is no calendar. */
export function CalendarRoot({ state }: { state: CalendarState }) {
  let body
  if (state.kind === 'empty')
    body = (
      <div className="saga-calview-state">
        <p>{state.message}</p>
        {state.issues.length > 0 ? (
          <ul aria-label="Problems with the calendar">
            {state.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  else if (state.display === 'calendar') body = <CalendarDisplay key={state.file.path} state={state} />
  else body = <p className="saga-calview-state">The {state.display} display is not available yet.</p>
  return <div className="saga-calview">{body}</div>
}
