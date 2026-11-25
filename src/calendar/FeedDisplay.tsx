import { useEffect, useState } from 'react'
import { formatDate, type CalendarDate } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import { toExcerpt } from '../shared/markdown/excerpt'
import type { CalendarEntry } from './entries'
import { buildFeed, type FeedEntry, type Order } from './feed'
import type { CalendarHost } from './host'
import type { CalendarState } from './types'
import './feed.css'

type Ready = Extract<CalendarState, { kind: 'calendar' }>

const EXCERPT_CHARS = 140

const PRECISION_LABEL = { day: 'Day', month: 'Month', year: 'Year', era: 'Era' } as const

/** A date without its year, for an entry under a marker that gives the year; the month is also left out of an end in the start's month. */
function withinYear(calendar: Calendar, date: CalendarDate, year: number): string | undefined {
  if (!('year' in date) || date.year !== year || date.month === undefined || date.day === undefined) return undefined
  return `${date.day} ${calendar.months[date.month - 1]?.name ?? `Month ${date.month}`}`
}

/** The date as the feed shows it; under a year marker a day date leaves out the year. */
function dateText(calendar: Calendar, { entry, start }: FeedEntry, under: number | undefined): string {
  const { end } = entry
  const from = (under !== undefined && withinYear(calendar, start, under)) || formatDate(calendar, start)
  if (!end) return from
  if (under !== undefined && 'year' in start && 'year' in end && start.month === end.month && start.year === end.year && start.day !== undefined && end.day !== undefined && withinYear(calendar, start, under))
    return `${start.day} – ${withinYear(calendar, end, under)}`
  return `${from} – ${(under !== undefined && withinYear(calendar, end, under)) || formatDate(calendar, end)}`
}

function Link({ host, file, className, children }: { host: CalendarHost; file: CalendarEntry['file']; className?: string; children: string }) {
  return (
    <a
      href={file.path}
      className={`internal-link${className ? ` ${className}` : ''}`}
      onClick={(event) => {
        event.preventDefault()
        host.openNote(file, event.metaKey || event.ctrlKey)
      }}
      onMouseOver={(event) => host.hoverNote(event.nativeEvent, event.currentTarget, file)}
    >
      {children}
    </a>
  )
}

/** The banner image at 96px, positioned by the note's `banner-y`; gone when the image fails to load. */
function Banner({ url, y }: NonNullable<CalendarEntry['banner']>) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <div className="saga-feed-banner">
      <img ref={(el) => el?.setCssProps({ '--saga-feed-banner-y': `${y}%` })} src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
    </div>
  )
}

function Excerpt({ host, file }: { host: CalendarHost; file: CalendarEntry['file'] }) {
  const [text, setText] = useState('')
  useEffect(() => {
    let live = true
    setText('')
    void host.excerpt(file).then((raw) => live && setText(toExcerpt(raw, EXCERPT_CHARS)))
    return () => {
      live = false
    }
  }, [host, file])
  return text ? <p className="saga-feed-excerpt">{text}</p> : null
}

/** The Feed display: the calendar's link and the Order control above a central spine of entries, with era headers, gap and year markers. */
export function FeedDisplay({ state }: { state: Ready }) {
  const { calendar, entries, host, file } = state
  // The order the control chose, until the `order` option shows it.
  const [pending, setPending] = useState<Order | null>(null)
  const order = pending ?? state.order
  if (pending !== null && pending === state.order) setPending(null)
  const { rows, problems } = buildFeed(calendar, entries, order)
  const choose = (next: Order): void => {
    setPending(next)
    state.setOption('order', next)
  }

  return (
    <div className="saga-calview-display saga-feed">
      <header className="saga-calview-header">
        <div className="saga-calview-heading">
          <span className="saga-calview-on">
            On <Link host={host} file={file}>{state.title}</Link>
          </span>
        </div>
        <div role="group" aria-label="Order" className="saga-calview-range">
          <button type="button" aria-pressed={order === 'oldest'} onClick={() => choose('oldest')}>
            Oldest first
          </button>
          <button type="button" aria-pressed={order === 'newest'} onClick={() => choose('newest')}>
            Newest first
          </button>
        </div>
      </header>
      <div className="saga-calview-body">
        <div className="saga-calview-content">
          {problems.length > 0 ? (
            <section className="saga-feed-problems" aria-labelledby="saga-feed-problems">
              <h2 id="saga-feed-problems" className="saga-calview-chips-label">
                Date problem
              </h2>
              <ul>
                {problems.map((entry) => (
                  <li key={entry.file.path} data-renderer={entry.renderer}>
                    <Link host={host} file={entry.file}>{entry.title}</Link>
                    <span className="saga-feed-issues">{entry.issues.join('; ')}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {rows.length === 0 ? (
            problems.length === 0 ? (
              <p className="saga-calview-state">No dated notes on {state.title}.</p>
            ) : null
          ) : (
            <ol className="saga-feed-list" aria-label="Feed">
              {rows.map((row, index) => {
                if (row.kind === 'era')
                  return (
                    <li key={`era-${index}`} className="saga-feed-row saga-feed-marker">
                      <h2 className="saga-feed-era">
                        {row.era.name} <span className="saga-feed-short">{row.era.short}</span>
                      </h2>
                    </li>
                  )
                if (row.kind === 'gap')
                  return (
                    <li key={`gap-${index}`} className="saga-feed-row saga-feed-marker saga-feed-gap">
                      <span>{row.years === 1 ? '1 year' : `${row.years.toLocaleString()} years`}</span>
                    </li>
                  )
                if (row.kind === 'year')
                  return (
                    <li key={`year-${index}`} className="saga-feed-row saga-feed-marker">
                      <h3 className="saga-feed-year">{formatDate(calendar, { year: row.year })}</h3>
                    </li>
                  )
                const { item } = row
                const { entry } = item
                const date = dateText(calendar, item, row.under)
                return (
                  <li key={entry.file.path} className="saga-feed-row saga-feed-entry" data-side={row.side}>
                    <article className="saga-feed-card" data-renderer={entry.renderer} data-precision={item.precision}>
                      {state.banners && entry.banner ? <Banner {...entry.banner} /> : null}
                      <p className="saga-feed-date">
                        {date}
                        {item.precision !== 'day' ? <span className="saga-feed-precision">{PRECISION_LABEL[item.precision]}</span> : null}
                      </p>
                      <h3 className="saga-feed-title">
                        <Link host={host} file={entry.file}>{entry.title}</Link>
                      </h3>
                      <Excerpt host={host} file={entry.file} />
                    </article>
                    <span aria-hidden="true" className="saga-feed-node" data-renderer={entry.renderer} data-precision={item.precision} />
                  </li>
                )
              })}
            </ol>
          )}
          <p className="saga-feed-legend">
            <span>
              <span aria-hidden="true" className="saga-feed-node" data-precision="day" />
              Day
            </span>
            <span>
              <span aria-hidden="true" className="saga-feed-node" data-precision="month" />
              Month or year
            </span>
            <span>
              <span aria-hidden="true" className="saga-feed-node" data-precision="era" />
              Era
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
