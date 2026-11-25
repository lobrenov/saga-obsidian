import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { setField } from '../obsidian/vault'
import { addMonths, addYears, dayNumber, eraOf, eraSpan, formatDate, fromDayNumber, monthGrid, shortNames, type CalendarDate, type GridDay } from '../shared/calendars/dates'
import type { Calendar, Era } from '../shared/calendars/schema'
import type { EditorProps } from '../shared/renderers/define'
import { useHeader } from './env'
import { FileInput, type EditorCtx } from './fieldEditors'
import { Icon } from './Icon'
import { calendarFilter, NO_CALENDAR, type NoteCalendar } from './noteCalendar'

const POPOVER_WIDTH = 320
const EDGE = 8

const PRECISIONS = ['Era', 'Year', 'Month', 'Day'] as const
type Precision = (typeof PRECISIONS)[number]

const precisionOf = (date: CalendarDate | undefined): Precision => (!date ? 'Day' : 'era' in date ? 'Era' : date.day !== undefined ? 'Day' : date.month !== undefined ? 'Month' : 'Year')

interface PickerProps {
  calendar: Calendar
  value: CalendarDate | undefined
  onPick: (date: CalendarDate) => void
  /** The id of the visible title of a month or day pane. */
  titleId: string
}

const sameDay = (a: GridDay | null, b: GridDay | null): boolean => a !== null && b !== null && a.year === b.year && a.month === b.month && a.day === b.day

/** The month a month or day pane opens on: the value's, an era's first year, else year 1. */
function startOf(calendar: Calendar, value: CalendarDate | undefined): { year: number; month: number } {
  if (value && 'year' in value) return { year: value.year, month: Math.min(Math.max(value.month ?? 1, 1), calendar.months.length) }
  const era = value && calendar.eras.find((candidate) => candidate.name === value.era)
  if (era) {
    const { from, to } = eraSpan(calendar, era)
    return { year: Number.isFinite(from) ? from : to, month: 1 }
  }
  return { year: 1, month: 1 }
}

/** The day `delta` days from `day`, with the view moved to its month when the grid does not show it. */
function shifted(calendar: Calendar, view: { year: number; month: number }, day: GridDay, delta: number): { view: { year: number; month: number }; day: GridDay } {
  const date = fromDayNumber(calendar, dayNumber(calendar, day.year, day.month, day.day) + delta)
  const target: GridDay = { ...date, inMonth: true }
  const shown = monthGrid(calendar, view.year, view.month).flat().some((cell) => sameDay(cell, target))
  return { view: shown ? view : { year: date.year, month: date.month }, day: target }
}

/** The year a text names: a number (`1312`, `-600`), or year N of an era by its short name (`600 BL` counts back from year 1, `5 AL` up from the era's year 1 as the calendar counts). */
function parseYear(calendar: Calendar, text: string): { year: number } | { error: string } {
  const match = /^(-?)\s*(\d+)\s*(\S.*)?$/.exec(text.trim())
  if (!match) return { error: 'Enter a whole number' }
  const count = Number(match[2])
  if (!Number.isSafeInteger(count)) return { error: 'That year is too large' }
  if (count === 0) return { error: 'There is no year 0' }
  const suffix = match[3]?.trim()
  if (!suffix) return { year: match[1] ? -count : count }
  const era = calendar.eras.find((candidate) => candidate.short.toLowerCase() === suffix.toLowerCase())
  if (!era) return { error: `Unknown era ${suffix}` }
  if (match[1] && era.side === 'after') return { error: `${era.short} years are not negative` }
  const year = era.side === 'before' ? -count : count
  const { from, to } = eraSpan(calendar, era)
  return year >= from && year <= to ? { year } : { error: `${count} ${era.short} is outside ${era.name}` }
}

/** The years of an era: `Until 601 DA`, `600 BL – 1 BL`, `1400 ST onward`. */
function spanText(calendar: Calendar, era: Era): string {
  const { from, to } = eraSpan(calendar, era)
  const at = (year: number): string => formatDate(calendar, { year })
  return !Number.isFinite(from) ? `Until ${at(to)}` : !Number.isFinite(to) ? `${at(from)} onward` : `${at(from)} – ${at(to)}`
}

function EraList({ calendar, value, onPick }: PickerProps) {
  if (calendar.eras.length === 0) return <p className="saga-lore-note">This calendar has no eras</p>
  return (
    <div role="group" aria-label="Era" className="saga-lore-eras">
      {(
        [
          ['Before year 1', 'before'],
          ['From year 1', 'after']
        ] as const
      ).map(([title, side]) => {
        const eras = calendar.eras.filter((era) => era.side === side)
        return eras.length === 0 ? null : (
          <Fragment key={side}>
            <p className="saga-lore-group">{title}</p>
            {eras.map((era) => (
              <button key={era.name} type="button" aria-pressed={value !== undefined && 'era' in value && value.era === era.name} className="saga-lore-era" onClick={() => onPick({ era: era.name })}>
                <span className="saga-lore-era-name">
                  {era.name}
                  <span className="saga-lore-era-span">{spanText(calendar, era)}</span>
                </span>
                <span className="saga-lore-era-short">{era.short}</span>
              </button>
            ))}
          </Fragment>
        )
      })}
    </div>
  )
}

function YearPicker({ calendar, value, onPick }: PickerProps) {
  const [text, setText] = useState(value && 'year' in value ? String(value.year) : '')
  const [shown, setShown] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const eraId = useId()
  useLayoutEffect(() => input.current?.focus(), [])
  const parsed = parseYear(calendar, text)
  const error = shown && 'error' in parsed ? parsed.error : null
  const submit = (): void => {
    setShown(true)
    if ('year' in parsed) onPick({ year: parsed.year })
  }
  return (
    <div className="saga-lore-year">
      <div className="saga-lore-year-row">
        <input
          ref={input}
          type="text"
          className="saga-header-input"
          aria-label="Year"
          aria-invalid={error !== null || undefined}
          aria-describedby={error !== null ? `${eraId} ${hintId}` : eraId}
          placeholder="Year"
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(event) => {
            setText(event.currentTarget.value)
            setShown(true)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            submit()
          }}
        />
        <span id={eraId} className="saga-lore-era-label" aria-hidden="true">
          {'year' in parsed ? (eraOf(calendar, parsed.year)?.short ?? '') : ''}
        </span>
        <button type="button" className="mod-cta" onClick={submit}>
          Set year
        </button>
      </div>
      {error ? (
        <p id={hintId} role="alert" className="saga-header-hint">
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface Step {
  label: string
  icon: string
  on: () => void
}

/** A title between the steps back and forward. */
function Nav({ title, titleId, back, forward }: { title: string; titleId: string; back: Step[]; forward: Step[] }) {
  const button = ({ label, icon, on }: Step) => (
    <button key={label} type="button" className="saga-calendar-step" aria-label={label} onClick={on}>
      <Icon name={icon} />
    </button>
  )
  return (
    <div className="saga-lore-nav">
      {back.map(button)}
      <h2 id={titleId} className="saga-lore-title">
        {title}
      </h2>
      {forward.map(button)}
    </div>
  )
}

function MonthPicker({ calendar, value, onPick, titleId }: PickerProps) {
  const [year, setYear] = useState(() => startOf(calendar, value).year)
  return (
    <div>
      <Nav
        title={formatDate(calendar, { year })}
        titleId={titleId}
        back={[{ label: 'Previous year', icon: 'chevron-left', on: () => setYear(addYears(year, -1)) }]}
        forward={[{ label: 'Next year', icon: 'chevron-right', on: () => setYear(addYears(year, 1)) }]}
      />
      <div role="group" aria-labelledby={titleId} className="saga-lore-months">
        {calendar.months.map((month, i) => (
          <button
            key={i}
            type="button"
            className="saga-lore-pick"
            aria-label={formatDate(calendar, { year, month: i + 1 })}
            aria-pressed={value !== undefined && 'year' in value && value.year === year && value.month === i + 1 && value.day === undefined}
            onClick={() => onPick({ year, month: i + 1 })}
          >
            {month.name}
          </button>
        ))}
      </div>
    </div>
  )
}

/** A month as a grid of days. One day is the tab stop (the last focused, else the selected, else the 1st); arrows, Home, End, PageUp and PageDown move between days and months. */
function DayPicker({ calendar, value, onPick, titleId }: PickerProps) {
  const [view, setView] = useState(() => startOf(calendar, value))
  const [active, setActive] = useState<GridDay | null>(null)
  const pending = useRef<GridDay | null>(null)
  const group = useRef<HTMLDivElement | null>(null)
  const cells = monthGrid(calendar, view.year, view.month).flat()
  const columns = calendar.weekdays.length
  const selected: GridDay | null = value && 'year' in value && value.month !== undefined && value.day !== undefined ? { year: value.year, month: value.month, day: value.day, inMonth: true } : null
  const shown = (day: GridDay | null): GridDay | null => (day && cells.find((cell) => sameDay(cell, day))) || null
  const stop = shown(active) ?? shown(selected) ?? cells.find((cell) => cell.inMonth) ?? null
  const step = (months: number) => (): void => setView(addMonths(calendar, view, months))

  useLayoutEffect(() => {
    const day = pending.current
    pending.current = null
    if (day) group.current?.querySelector<HTMLElement>(`[data-date="${day.year}-${day.month}-${day.day}"]`)?.focus()
  })

  const go = (day: GridDay, key: string): boolean => {
    const at = cells.findIndex((cell) => sameDay(cell, day))
    const byMonths = (months: number): { view: typeof view; day: GridDay } => {
      const next = addMonths(calendar, view, months)
      return { view: next, day: { ...next, day: Math.min(day.day, calendar.months[next.month - 1]?.days ?? 1), inMonth: true } }
    }
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns, Home: -(at % columns), End: columns - 1 - (at % columns) }
    const offset = offsets[key]
    const target = offset !== undefined ? shifted(calendar, view, day, offset) : key === 'PageUp' ? byMonths(-1) : key === 'PageDown' ? byMonths(1) : null
    if (!target) return false
    setView(target.view)
    setActive(target.day)
    pending.current = target.day
    return true
  }

  return (
    <div>
      <Nav
        title={formatDate(calendar, view)}
        titleId={titleId}
        back={[
          { label: 'Previous year', icon: 'chevrons-left', on: step(-calendar.months.length) },
          { label: 'Previous month', icon: 'chevron-left', on: step(-1) }
        ]}
        forward={[
          { label: 'Next month', icon: 'chevron-right', on: step(1) },
          { label: 'Next year', icon: 'chevrons-right', on: step(calendar.months.length) }
        ]}
      />
      <div
        ref={(el) => {
          group.current = el
          el?.setCssProps({ '--saga-lore-columns': String(columns) })
        }}
        role="group"
        aria-labelledby={titleId}
        className="saga-lore-days"
      >
        {shortNames(calendar.weekdays).map((short, i) => (
          <span key={i} className="saga-lore-weekday" title={calendar.weekdays[i]} aria-hidden="true">
            {short}
          </span>
        ))}
        {cells.map((day) => (
          <button
            key={`${day.year}-${day.month}-${day.day}`}
            type="button"
            className="saga-lore-day"
            data-date={`${day.year}-${day.month}-${day.day}`}
            data-outside={day.inMonth ? undefined : ''}
            tabIndex={sameDay(day, stop) ? 0 : -1}
            aria-label={formatDate(calendar, day)}
            aria-pressed={sameDay(day, selected)}
            onFocus={() => setActive(day)}
            onClick={() => onPick({ year: day.year, month: day.month, day: day.day })}
            onKeyDown={(event) => {
              if (go(day, event.key)) event.preventDefault()
            }}
          >
            {day.day}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Asks for the note's calendar: a suggester over calendar notes; a pick writes the link. */
function CalendarChooser({ calendar }: { calendar: NoteCalendar }) {
  const { env, file, config } = useHeader()
  const [error, setError] = useState<string | null>(null)
  const only = useMemo(() => calendarFilter(env.app, config), [env, config])
  return (
    <div className="saga-lore-choose">
      {calendar.file ? (
        <p className="saga-header-hint">
          {calendar.file.basename} is not a valid calendar{calendar.issues[0] ? `: ${calendar.issues[0].message}` : ''}
        </p>
      ) : null}
      <FileInput
        kind="note"
        only={only}
        className="saga-header-input"
        aria-label="Calendar"
        placeholder="Choose a calendar…"
        autoFocus
        onPick={(target) => void setField(env.app, file, calendar.key, `[[${target}]]`).then((result) => setError(result.ok ? null : `Could not update “${calendar.key}”: ${result.error.message}`))}
      />
      {error ? (
        <p role="alert" className="saga-header-hint">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A date: the box shows it at its precision; the popover switches the precision and picks an era, year, month or day of the note's calendar.
 * Without a calendar the popover asks for one first. Choosing calls `onChange`; Escape or a press outside closes the popover with nothing written.
 */
export function DateEditor({ field, value, onChange, id, invalid, describedBy, calendar }: EditorProps<'date'> & EditorCtx) {
  const { env, file } = useHeader()
  const [open, setOpen] = useState(false)
  const [precision, setPrecision] = useState<Precision>(() => precisionOf(value))
  const root = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const hasCalendar = calendar?.calendar !== undefined

  // The popover keeps to the card and the window: it is narrowed to fit and moved in from either edge.
  useLayoutEffect(() => {
    const box = root.current
    const pop = popover.current
    const card = box?.closest('.saga-header')
    if (!open || !box || !pop || !card) return
    const bounds = card.getBoundingClientRect()
    const left = Math.max(bounds.left, 0) + EDGE
    const right = Math.min(bounds.right, box.ownerDocument.defaultView?.innerWidth ?? bounds.right) - EDGE
    const width = Math.max(Math.min(POPOVER_WIDTH, right - left), 0)
    const at = box.getBoundingClientRect().left
    pop.setCssProps({ '--saga-lore-width': `${width}px`, '--saga-lore-offset': `${Math.min(Math.max(at, left), right - width) - at}px` })
  }, [open, hasCalendar])

  // Focus moves into the popover: the selected item, else the pane's first control.
  useLayoutEffect(() => {
    const pop = popover.current
    if (!open || !pop || pop.contains(pop.ownerDocument.activeElement)) return
    const pane = pop.querySelector('.saga-lore-pane') ?? pop
    ;(pane.querySelector<HTMLElement>('[aria-pressed="true"]') ?? pane.querySelector<HTMLElement>('[tabindex="0"]') ?? pane.querySelector<HTMLElement>('button, input'))?.focus()
  }, [open, hasCalendar])

  useEffect(() => {
    if (!open) return
    const doc = root.current?.ownerDocument
    const away = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (target?.instanceOf(Element) && !root.current?.contains(target) && !target.closest('.suggestion-container')) setOpen(false)
    }
    doc?.addEventListener('pointerdown', away, true)
    return () => doc?.removeEventListener('pointerdown', away, true)
  }, [open])

  if (!calendar) return null
  const range = calendar.calendar
  const close = (): void => {
    setOpen(false)
    trigger.current?.focus()
  }
  const pick = (date: CalendarDate): void => {
    onChange(date)
    close()
  }
  const toggle = (): void => {
    if (!open) setPrecision(precisionOf(value))
    setOpen(!open)
  }
  const titled = precision === 'Month' || precision === 'Day'
  const picker: PickerProps | undefined = range ? { calendar: range, value, onPick: pick, titleId } : undefined
  const target = calendar.file ? env.app.metadataCache.fileToLinktext(calendar.file, file.path, true) : ''

  const popoverEl = open ? (
    <div
      ref={popover}
      role="dialog"
      aria-label={picker && titled ? undefined : `${field.label} date`}
      aria-labelledby={picker && titled ? titleId : undefined}
      className="saga-lore-popover"
    >
      {picker ? (
        <>
          <div role="group" aria-label="Precision" className="saga-lore-precision">
            {PRECISIONS.map((name) => (
              <button key={name} type="button" aria-pressed={precision === name} onClick={() => setPrecision(name)}>
                {name}
              </button>
            ))}
          </div>
          <div className="saga-lore-pane">
            {precision === 'Era' ? <EraList {...picker} /> : precision === 'Year' ? <YearPicker {...picker} /> : precision === 'Month' ? <MonthPicker {...picker} /> : <DayPicker {...picker} />}
          </div>
          {calendar.file ? (
            <p className="saga-lore-on">
              On{' '}
              <button
                type="button"
                className="saga-lore-link"
                onClick={(event) => env.openLink(target, file.path, event)}
                onMouseOver={(event) => env.hover(event.nativeEvent, event.currentTarget, target, file.path)}
              >
                {calendar.file.basename}
              </button>
            </p>
          ) : null}
        </>
      ) : (
        <CalendarChooser calendar={calendar} />
      )}
    </div>
  ) : null

  return (
    <span
      ref={root}
      className="saga-lore-date"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return
        event.preventDefault()
        event.stopPropagation()
        close()
      }}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null
        if (next?.instanceOf(Element) && !root.current?.contains(next) && !next.closest('.suggestion-container')) setOpen(false)
      }}
    >
      {value ? (
        <span className="saga-header-chip saga-lore-date-chip" data-invalid={invalid || undefined} data-open={open || undefined}>
          <button
            ref={trigger}
            id={id}
            type="button"
            className="saga-header-chip-link"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onClick={toggle}
          >
            <Icon name="calendar" />
            {formatDate(range ?? NO_CALENDAR, value)}
          </button>
          {popoverEl}
          <button type="button" className="saga-header-chip-action" aria-label={`Edit ${field.label}`} onClick={toggle}>
            <Icon name="pencil" />
          </button>
          <button
            type="button"
            className="saga-header-chip-action"
            aria-label={`Remove ${field.label}`}
            onClick={() => {
              setOpen(false)
              onChange(undefined)
            }}
          >
            <Icon name="x" />
          </button>
        </span>
      ) : (
        <>
          <button
            ref={trigger}
            id={id}
            type="button"
            className="saga-header-add"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onClick={toggle}
          >
            <Icon name="plus" />
            {field.prefix === '' ? 'Set date' : 'Add end'}
          </button>
          {popoverEl}
        </>
      )}
    </span>
  )
}
