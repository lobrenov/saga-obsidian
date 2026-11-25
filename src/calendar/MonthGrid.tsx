import { useState } from 'react'
import { dayNumber, formatDate, monthGrid, shortNames } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import { rendererDefs } from '../shared/renderers/definitions'
import { weekBars } from './bars'
import type { CalendarEntry } from './entries'
import { Glyph } from './Glyph'
import type { CalendarHost } from './host'
import type { Placed } from './placement'
import { useHiddenLabel } from '../ui/hiddenLabel'

export interface Selection {
  path: string
  /** The `data-slot` of the element the card opened from. */
  slot: string
}

/** Bars a week shows; the rest are behind a "+N" button. */
const MAX_LANES = 3

interface GridProps {
  calendar: Calendar
  host: CalendarHost
  year: number
  month: number
  days: readonly Placed[]
  selected: Selection | null
  onSelect: (entry: CalendarEntry, slot: string) => void
}

/** One month on the calendar's weekdays; an entry on several days is one bar per week, continued across the cells it covers. */
export function MonthGrid({ calendar, host, year, month, days, selected, onSelect }: GridProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const short = shortNames(calendar.weekdays)
  const [labelId, label] = useHiddenLabel(formatDate(calendar, { year, month }))
  return (
    <div role="group" aria-labelledby={labelId} className="saga-calview-grid" ref={(el) => el?.setCssProps({ '--saga-calview-columns': String(calendar.weekdays.length) })}>
      {label}
      <div className="saga-calview-week">
        {calendar.weekdays.map((weekday, i) => (
          <div key={weekday} className="saga-calview-weekday">
            <span className="saga-calview-weekday-full">{weekday}</span>
            <span className="saga-calview-weekday-short" aria-hidden="true" title={weekday}>
              {short[i]}
            </span>
          </div>
        ))}
      </div>
      {monthGrid(calendar, year, month).map((week, w) => {
        const [head] = week
        const bars = weekBars(days, head ? dayNumber(calendar, head.year, head.month, head.day) : 0, week.length)
        const lanes = bars.reduce((count, bar) => (bar.lane < MAX_LANES ? Math.max(count, bar.lane + 1) : count), 0)
        return (
          <div key={w} className="saga-calview-week">
            {week.map((day, col) => {
              const full = formatDate(calendar, { year: day.year, month: day.month, day: day.day })
              const here = bars.filter((bar) => bar.first <= col && col <= bar.last).sort((a, b) => a.lane - b.lane)
              const hidden = here.filter((bar) => bar.lane >= MAX_LANES).length
              const more = `more|${w}|${col}`
              return (
                <div key={col} className="saga-calview-day" data-outside={!day.inMonth || undefined}>
                  <span className="saga-calview-daynum">
                    <span aria-hidden="true">{day.day}</span>
                    <span className="saga-calview-sr">{full}</span>
                  </span>
                  {Array.from({ length: lanes }, (_, lane) => {
                    const bar = here.find((candidate) => candidate.lane === lane)
                    if (!bar) return <span key={lane} className="saga-calview-bar" data-spacer="" aria-hidden="true" />
                    const { entry } = bar.item
                    const path = entry.file.path
                    const slot = `${path}|${w}`
                    const shared = {
                      className: 'saga-calview-bar',
                      'data-renderer': entry.renderer,
                      'data-entry': path,
                      'data-selected': selected?.path === path || undefined,
                      'data-hover': hovered === path || undefined,
                      'data-join-start': bar.before || col > bar.first || undefined,
                      'data-join-end': bar.after || col < bar.last || undefined,
                      onMouseEnter: () => setHovered(path),
                      onMouseLeave: () => setHovered(null)
                    }
                    if (col > bar.first) return <span key={lane} {...shared} data-span="" aria-hidden="true" onClick={() => onSelect(entry, slot)} />
                    return (
                      <button
                        key={lane}
                        type="button"
                        title={entry.title}
                        aria-haspopup="dialog"
                        aria-expanded={selected?.slot === slot}
                        data-slot={slot}
                        data-span={bar.first !== bar.last || bar.before || bar.after || undefined}
                        {...shared}
                        onClick={() => onSelect(entry, slot)}
                      >
                        <Glyph name={rendererDefs[entry.renderer].icon} />
                        <span className="saga-calview-bar-text">{entry.title}</span>
                      </button>
                    )
                  })}
                  {hidden > 0 ? (
                    <button
                      type="button"
                      className="saga-calview-more"
                      aria-haspopup="menu"
                      aria-label={`${hidden} more on ${full}`}
                      aria-expanded={selected?.slot === more}
                      data-slot={more}
                      onClick={(event) => {
                        const box = event.currentTarget.getBoundingClientRect()
                        host.showMenu(
                          { x: box.left, y: box.bottom },
                          here.map((bar) => ({ title: bar.item.entry.title, onClick: () => onSelect(bar.item.entry, more) }))
                        )
                      }}
                    >
                      +{hidden}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
