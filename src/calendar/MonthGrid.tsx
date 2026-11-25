import { dayNumber, formatDate, monthGrid } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import { rendererDefs } from '../shared/renderers/definitions'
import { weekBars } from './bars'
import type { CalendarEntry } from './entries'
import { Glyph } from './Glyph'
import type { Placed } from './placement'

export interface Selection {
  path: string
  /** The `data-slot` of the element the card opened from. */
  slot: string
}

interface GridProps {
  calendar: Calendar
  year: number
  month: number
  days: readonly Placed[]
  selected: Selection | null
  onSelect: (entry: CalendarEntry, slot: string) => void
}

/** One month on the calendar's weekdays; an entry on several days is one bar per week, continued across the cells it covers. */
export function MonthGrid({ calendar, year, month, days, selected, onSelect }: GridProps) {
  const weeks = monthGrid(calendar, year, month)
  return (
    <div role="grid" aria-label={formatDate(calendar, { year, month })} className="saga-calview-grid" ref={(el) => el?.setCssProps({ '--saga-calview-columns': String(calendar.weekdays.length) })}>
      <div role="row" className="saga-calview-week">
        {calendar.weekdays.map((weekday) => (
          <div key={weekday} role="columnheader" className="saga-calview-weekday">
            {weekday}
          </div>
        ))}
      </div>
      {weeks.map((week, w) => {
        const [head] = week
        const bars = weekBars(days, head ? dayNumber(calendar, head.year, head.month, head.day) : 0, week.length)
        const lanes = bars.reduce((count, bar) => Math.max(count, bar.lane + 1), 0)
        return (
          <div key={w} role="row" className="saga-calview-week">
            {week.map((day, col) => (
              <div key={col} role="gridcell" aria-label={`${day.day} ${calendar.months[day.month - 1]?.name ?? ''}`} className="saga-calview-day" data-outside={!day.inMonth || undefined}>
                <span className="saga-calview-daynum">{day.day}</span>
                {Array.from({ length: lanes }, (_, lane) => {
                  const bar = bars.find((candidate) => candidate.lane === lane && candidate.first <= col && col <= candidate.last)
                  if (!bar) return <span key={lane} className="saga-calview-bar" data-spacer="" aria-hidden="true" />
                  const { entry } = bar.item
                  const slot = `${entry.file.path}|${w}`
                  const joins = { 'data-join-start': bar.before || col > bar.first || undefined, 'data-join-end': bar.after || col < bar.last || undefined }
                  if (col > bar.first) return <span key={lane} className="saga-calview-bar" data-renderer={entry.renderer} data-span="" data-selected={selected?.path === entry.file.path || undefined} aria-hidden="true" {...joins} onClick={() => onSelect(entry, slot)} />
                  return (
                    <button
                      key={lane}
                      type="button"
                      className="saga-calview-bar"
                      title={entry.title}
                      aria-haspopup="dialog"
                      aria-expanded={selected?.slot === slot}
                      data-slot={slot}
                      data-renderer={entry.renderer}
                      data-span={bar.first !== bar.last || bar.before || bar.after || undefined}
                      data-selected={selected?.path === entry.file.path || undefined}
                      {...joins}
                      onClick={() => onSelect(entry, slot)}
                    >
                      <Glyph name={rendererDefs[entry.renderer].icon} />
                      <span className="saga-calview-bar-text">{entry.title}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
