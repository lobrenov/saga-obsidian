import { useId } from 'react'
import { dayNumber, formatDate, monthGrid } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import type { CalendarEntry } from './entries'
import type { CalendarHost } from './host'
import type { Selection } from './MonthGrid'

/** The entries on a day; `start` is true on the day an entry begins. */
export type DayEntries = ReadonlyMap<number, { entry: CalendarEntry; start: boolean }[]>

interface YearGridProps {
  calendar: Calendar
  host: CalendarHost
  year: number
  byDay: DayEntries
  selected: Selection | null
  onSelect: (entry: CalendarEntry, slot: string) => void
}

/** A year as one small month per month of the calendar; a day with entries is a button (a menu of them when there are several). */
export function YearGrid({ calendar, host, year, byDay, selected, onSelect }: YearGridProps) {
  const id = useId()
  return (
    <div className="saga-calview-year">
      {calendar.months.map((month, m) => (
        <section key={m} className="saga-calview-mini" aria-labelledby={`${id}-${m}`}>
          <h3 id={`${id}-${m}`} className="saga-calview-mini-title">
            {month.name}
          </h3>
          <div role="group" aria-labelledby={`${id}-${m}`} className="saga-calview-mini-grid" ref={(el) => el?.setCssProps({ '--saga-calview-columns': String(calendar.weekdays.length) })}>
            <div className="saga-calview-week" aria-hidden="true">
              {calendar.weekdays.map((weekday) => (
                <div key={weekday} className="saga-calview-weekday" title={weekday}>
                  {Array.from(weekday)[0]}
                </div>
              ))}
            </div>
            {monthGrid(calendar, year, m + 1).map((week, w) => (
              <div key={w} className="saga-calview-week">
                {week.map((day, col) => {
                  if (!day.inMonth) return <div key={col} className="saga-calview-mini-day" data-outside="" />
                  const here = byDay.get(dayNumber(calendar, year, m + 1, day.day)) ?? []
                  const first = here[0]
                  if (!first) return <div key={col} className="saga-calview-mini-day">{day.day}</div>
                  const slot = `day|${m}|${day.day}`
                  const titles = here.map(({ entry }) => entry.title).join(', ')
                  return (
                    <div key={col} className="saga-calview-mini-day">
                      <button
                        type="button"
                        className="saga-calview-mini-mark"
                        title={titles}
                        aria-label={`${formatDate(calendar, { year, month: m + 1, day: day.day })}: ${titles}`}
                        aria-haspopup={here.length > 1 ? 'menu' : 'dialog'}
                        aria-expanded={selected?.slot === slot}
                        data-slot={slot}
                        data-renderer={first.entry.renderer}
                        data-entry={here.length === 1 ? first.entry.file.path : undefined}
                        data-faint={!here.some(({ start }) => start) || undefined}
                        data-selected={here.some(({ entry }) => entry.file.path === selected?.path) || undefined}
                        onClick={(event) => {
                          if (here.length === 1) return onSelect(first.entry, slot)
                          const box = event.currentTarget.getBoundingClientRect()
                          host.showMenu(
                            { x: box.left, y: box.bottom },
                            here.map(({ entry }) => ({ title: entry.title, onClick: () => onSelect(entry, slot) }))
                          )
                        }}
                      >
                        {day.day}
                        {here.length > 1 ? (
                          <span className="saga-calview-mini-count" aria-hidden="true">
                            {here.length}
                          </span>
                        ) : null}
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
