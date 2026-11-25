import { useId, useMemo, useState } from 'react'
import { compareDates } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import { rendererDefs } from '../shared/renderers/definitions'
import { EntryCard } from './EntryCard'
import type { CalendarEntry } from './entries'
import { Glyph } from './Glyph'
import type { Selection } from './MonthGrid'
import { axisFor, markOf, position, stepYear, titleOf, windowYears, yearsOf, type Axis } from './timelineAxis'
import { rowDate, timelineRows, type TimelineRow } from './timelineRows'
import type { CalendarState, Scale } from './types'
import './timeline.css'

type Ready = Extract<CalendarState, { kind: 'calendar' }>

const SCALES: { id: Scale; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'century', label: 'Century' },
  { id: 'decade', label: 'Decade' },
  { id: 'year', label: 'Year' }
]
const FLIP_AT = 0.6

const percent = (fraction: number): string => `${(fraction * 100).toFixed(3)}%`

/** The year the display opens on: the earliest dated entry's, else year 1. */
function opening(calendar: Calendar, entries: readonly CalendarEntry[]): number {
  const first = entries.flatMap(({ start }) => (start && 'year' in start ? [start] : [])).sort((a, b) => compareDates(calendar, a, b))[0]
  return first && 'year' in first ? first.year : 1
}

/** The eras as one strip with a tick for each dated entry and a window over the range the chart shows. */
function Overview({ calendar, axis, rows, shown, title }: { calendar: Calendar; axis: Axis; rows: readonly TimelineRow[]; shown: Axis; title: string }) {
  const window = markOf(axis, shown.from, shown.to)
  return (
    <div className="saga-timeline-overview" role="img" aria-label={`Showing ${title}`}>
      {axis.columns.map((column, i) => (
        <span key={i} className="saga-timeline-era" title={column.title} data-side={calendar.eras[i]?.side} ref={(el) => el?.setCssProps({ '--saga-timeline-weight': String(column.weight) })}>
          {column.label}
        </span>
      ))}
      {rows
        .filter((row) => Number.isFinite(row.from) && row.from >= axis.from && row.from <= axis.to)
        .map((row) => (
          <span key={row.entry.file.path} className="saga-timeline-tick" ref={(el) => el?.setCssProps({ '--saga-timeline-left': percent(position(axis, row.from)) })} />
        ))}
      {window ? <span className="saga-timeline-window" ref={(el) => el?.setCssProps({ '--saga-timeline-left': percent(window.left), '--saga-timeline-width': percent(window.right - window.left) })} /> : null}
    </div>
  )
}

interface RowItemProps {
  calendar: Calendar
  row: TimelineRow
  axis: Axis
  selected: Selection | null
  onSelect: (entry: CalendarEntry, slot: string) => void
}

/** One entry: its label, which opens the card, and its mark on the axis with the dates beside it. */
function RowItem({ calendar, row, axis, selected, onSelect }: RowItemProps) {
  const { entry } = row
  const mark = markOf(axis, row.from, row.to)
  const slot = `timeline|${entry.file.path}`
  if (!mark) return null
  const middle = (mark.left + mark.right) / 2
  const flip = (row.kind === 'point' ? middle : mark.right) > FLIP_AT
  return (
    <li className="saga-timeline-row" data-renderer={entry.renderer} data-selected={selected?.path === entry.file.path || undefined}>
      <button type="button" className="saga-timeline-label" aria-haspopup="dialog" aria-expanded={selected?.slot === slot} data-slot={slot} onClick={() => onSelect(entry, slot)}>
        <Glyph name={rendererDefs[entry.renderer].icon} />
        <span className="saga-timeline-label-text">{entry.title}</span>
      </button>
      <div className="saga-timeline-track">
        <span
          aria-hidden="true"
          className="saga-timeline-mark"
          data-kind={row.kind}
          data-open-start={mark.openStart || undefined}
          data-open-end={mark.openEnd || undefined}
          ref={(el) => el?.setCssProps(row.kind === 'point' ? { '--saga-timeline-left': percent(middle) } : { '--saga-timeline-left': percent(mark.left), '--saga-timeline-width': percent(mark.right - mark.left) })}
        />
        <span
          className="saga-timeline-when"
          data-flip={flip || undefined}
          ref={(el) => el?.setCssProps({ '--saga-timeline-left': percent(row.kind === 'point' ? middle : flip ? mark.left : mark.right) })}
        >
          {rowDate(calendar, entry)}
        </span>
      </div>
    </li>
  )
}

/** The Timeline display: the window's title with the calendar's link, navigation and the Scale control, the era overview, the entries with a date problem, and one row per entry. */
export function TimelineDisplay({ state }: { state: Ready }) {
  const { calendar, entries, host, file } = state
  // The scale the control chose, until the `scale` option shows it.
  const [pending, setPending] = useState<Scale | null>(null)
  const [at, setAt] = useState(() => opening(calendar, entries))
  const [selected, setSelected] = useState<Selection | null>(null)
  const id = useId()
  const scale = pending ?? state.scale
  if (pending !== null && pending === state.scale) setPending(null)

  const { rows, unplaced } = useMemo(() => timelineRows(calendar, entries), [calendar, entries])
  const years = useMemo(() => entries.flatMap(({ start, end }) => yearsOf(start, end)), [entries])
  const axis = useMemo(() => axisFor(calendar, scale, at, years), [calendar, scale, at, years])
  // Open-ended eras reach out to the window, so the overview always holds it.
  const overview = useMemo(() => axisFor(calendar, 'all', at, scale === 'all' ? years : [...years, ...windowYears(scale, at)]), [calendar, scale, at, years])
  const shown = rows.filter((row) => markOf(axis, row.from, row.to))
  const card = selected ? entries.find((entry) => entry.file.path === selected.path) : undefined
  const onSelect = (entry: CalendarEntry, slot: string): void => setSelected(selected?.slot === slot ? null : { path: entry.file.path, slot })
  const title = titleOf(calendar, scale, at)
  const unit = scale === 'year' ? 'year' : scale

  const step = (n: number, from?: HTMLElement): void => {
    if (scale === 'all') return
    setAt((current) => stepYear(scale, current, n))
    setSelected(null)
    from?.focus()
  }
  const choose = (next: Scale): void => {
    setPending(next)
    setSelected(null)
    state.setOption('scale', next)
  }

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
          <h2 className="saga-calview-title">{title}</h2>
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
        {scale === 'all' ? null : (
          <div className="saga-calview-nav">
            <button type="button" className="saga-calview-step" aria-label={`Previous ${unit}`} onClick={(event) => step(-1, event.currentTarget)}>
              <Glyph name="chevron-left" />
            </button>
            <button type="button" className="saga-calview-step" aria-label={`Next ${unit}`} onClick={(event) => step(1, event.currentTarget)}>
              <Glyph name="chevron-right" />
            </button>
          </div>
        )}
        <div role="group" aria-label="Scale" className="saga-calview-range">
          {SCALES.map(({ id: option, label }) => (
            <button key={option} type="button" aria-pressed={scale === option} onClick={() => choose(option)}>
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="saga-calview-body">
        <div
          className="saga-calview-content saga-timeline"
          data-scale={scale}
          ref={(el) => el?.setCssProps({ '--saga-timeline-columns': String(axis.columns.length) })}
          onClick={(event) => {
            if (selected && !(event.target as Element).closest('[data-slot], .saga-calview-card')) setSelected(null)
          }}
        >
          {scale !== 'all' && calendar.eras.length > 0 ? <Overview calendar={calendar} axis={overview} rows={rows} shown={axis} title={title} /> : null}
          {unplaced.length > 0 ? (
            <div role="group" aria-labelledby={`${id}-problems`} className="saga-calview-chips">
              <span id={`${id}-problems`} className="saga-calview-chips-label">
                Date problem
              </span>
              {unplaced.map((entry) => {
                const slot = `Date problem|${entry.file.path}`
                return (
                  <button
                    key={entry.file.path}
                    type="button"
                    className="saga-calview-chip"
                    aria-haspopup="dialog"
                    aria-expanded={selected?.slot === slot}
                    data-slot={slot}
                    data-renderer={entry.renderer}
                    data-problem
                    data-selected={selected?.path === entry.file.path || undefined}
                    onClick={() => onSelect(entry, slot)}
                  >
                    {entry.title}
                  </button>
                )
              })}
            </div>
          ) : null}
          <div className="saga-timeline-scroll">
            <div className="saga-timeline-chart">
              <div className="saga-timeline-grid" aria-hidden="true">
                {axis.columns.map((column, i) => (
                  <span key={i} className="saga-timeline-column" ref={(el) => el?.setCssProps({ '--saga-timeline-weight': String(column.weight) })} />
                ))}
              </div>
              <div className="saga-timeline-head">
                <span className="saga-timeline-corner">Note</span>
                <div className="saga-timeline-columns">
                  {axis.columns.map((column, i) => (
                    <span key={i} className="saga-timeline-column-label" title={column.title} ref={(el) => el?.setCssProps({ '--saga-timeline-weight': String(column.weight) })}>
                      {column.label}
                    </span>
                  ))}
                </div>
              </div>
              {shown.length > 0 ? (
                <ol className="saga-timeline-rows">
                  {shown.map((row) => (
                    <RowItem key={row.entry.file.path} calendar={calendar} row={row} axis={axis} selected={selected} onSelect={onSelect} />
                  ))}
                </ol>
              ) : (
                <p className="saga-timeline-empty">Nothing is dated in {title}.</p>
              )}
            </div>
          </div>
          <p className="saga-timeline-legend">
            <span>
              <span aria-hidden="true" className="saga-timeline-swatch" data-kind="point" />
              Day
            </span>
            <span>
              <span aria-hidden="true" className="saga-timeline-swatch" data-kind="bar" />
              Date to end date
            </span>
            <span>
              <span aria-hidden="true" className="saga-timeline-swatch" data-kind="span" />
              Month, year or era (its whole length)
            </span>
            <span>Rows follow the base’s sort</span>
          </p>
          {card && selected ? <EntryCard key={selected.slot} host={host} calendar={calendar} entry={card} slot={selected.slot} onClose={() => setSelected(null)} /> : null}
        </div>
      </div>
    </div>
  )
}
