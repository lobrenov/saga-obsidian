import { dayNumber, formatDate, monthGrid } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import type { CalendarEntry } from './entries'
import type { CalendarHost } from './host'
import type { Selection } from './MonthGrid'
import type { Placed } from './placement'

interface YearGridProps {
  calendar: Calendar
  host: CalendarHost
  year: number
  days: readonly Placed[]
  selected: Selection | null
  onSelect: (entry: CalendarEntry, slot: string) => void
}

/** A year as one small month per month of the calendar; a day with entries is a button (a menu of them when there are several). */
export function YearGrid({ calendar, host, year, days, selected, onSelect }: YearGridProps) {
  return (
    <div className="saga-calview-year">
      {calendar.months.map((month, m) => (
        <section key={m} className="saga-calview-mini" aria-label={month.name}>
          <h3 className="saga-calview-mini-title">{month.name}</h3>
          <div role="grid" aria-label={formatDate(calendar, { year, month: m + 1 })} className="saga-calview-mini-grid" ref={(el) => el?.setCssProps({ '--saga-calview-columns': String(calendar.weekdays.length) })}>
            <div role="row" className="saga-calview-week">
              {calendar.weekdays.map((weekday) => (
                <div key={weekday} role="columnheader" aria-label={weekday} className="saga-calview-weekday">
                  {Array.from(weekday)[0]}
                </div>
              ))}
            </div>
            {monthGrid(calendar, year, m + 1).map((week, w) => (
              <div key={w} role="row" className="saga-calview-week">
                {week.map((day, col) => {
                  if (!day.inMonth) return <div key={col} role="gridcell" className="saga-calview-mini-day" data-outside="" />
                  const n = dayNumber(calendar, year, m + 1, day.day)
                  const here = days.filter((placed) => placed.from <= n && n <= placed.to).map((placed) => placed.entry)
                  const first = here[0]
                  if (!first) return <div key={col} role="gridcell" className="saga-calview-mini-day">{day.day}</div>
                  const slot = `day|${m}|${day.day}`
                  return (
                    <div key={col} role="gridcell" className="saga-calview-mini-day">
                      <button
                        type="button"
                        className="saga-calview-mini-mark"
                        aria-label={`${day.day} ${month.name}: ${here.map((entry) => entry.title).join(', ')}`}
                        aria-haspopup={here.length > 1 ? 'menu' : 'dialog'}
                        aria-expanded={selected?.slot === slot}
                        data-slot={slot}
                        data-renderer={first.renderer}
                        data-selected={here.some((entry) => entry.file.path === selected?.path) || undefined}
                        onClick={(event) => {
                          if (here.length === 1) return onSelect(first, slot)
                          const box = event.currentTarget.getBoundingClientRect()
                          host.showMenu(
                            { x: box.left, y: box.bottom },
                            here.map((entry) => ({ title: entry.title, onClick: () => onSelect(entry, slot) }))
                          )
                        }}
                      >
                        {day.day}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
