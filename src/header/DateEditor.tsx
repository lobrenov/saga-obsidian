import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { setField } from '../obsidian/vault'
import { addMonths, addYears, eraOf, eraSpan, formatDate, monthGrid, type CalendarDate } from '../shared/calendars/dates'
import type { Calendar, Era } from '../shared/calendars/schema'
import type { EditorProps } from '../shared/renderers/define'
import { useHeader } from './env'
import { FileInput, RemoveButton, type EditorCtx } from './fieldEditors'
import { Icon } from './Icon'
import { calendarFilter, linktextOf, NO_CALENDAR, type NoteCalendar } from './noteCalendar'

const PRECISIONS = ['Era', 'Year', 'Month', 'Day'] as const
type Precision = (typeof PRECISIONS)[number]

const precisionOf = (date: CalendarDate | undefined): Precision => (!date ? 'Day' : 'era' in date ? 'Era' : date.day !== undefined ? 'Day' : date.month !== undefined ? 'Month' : 'Year')

interface PickerProps {
  calendar: Calendar
  value: CalendarDate | undefined
  onPick: (date: CalendarDate) => void
}

/** The year a text names: a number (`1312`, `-600`), or a number and the short name of an era (`600 BL`). */
function parseYear(calendar: Calendar, text: string): { year: number } | { error: string } {
  const match = /^(-?)\s*(\d+)\s*(\S.*)?$/.exec(text.trim())
  if (!match) return { error: 'Enter a whole number' }
  const count = Number(match[2])
  if (count === 0) return { error: 'There is no year 0' }
  const suffix = match[3]?.trim()
  if (!suffix) return { year: match[1] ? -count : count }
  const era = calendar.eras.find((candidate) => candidate.short.toLowerCase() === suffix.toLowerCase())
  return era ? { year: era.side === 'before' ? -count : count } : { error: `Unknown era ${suffix}` }
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
    <div role="radiogroup" aria-label="Era" className="saga-lore-eras">
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
              <button key={era.name} type="button" role="radio" aria-checked={value !== undefined && 'era' in value && value.era === era.name} className="saga-lore-era" onClick={() => onPick({ era: era.name })}>
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
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => input.current?.focus(), [])
  const parsed = parseYear(calendar, text)
  const submit = (): void => ('error' in parsed ? setError(parsed.error) : onPick({ year: parsed.year }))
  return (
    <div className="saga-lore-year">
      <div className="saga-lore-year-row">
        <input
          ref={input}
          type="text"
          className="saga-header-input"
          aria-label="Year"
          placeholder="Year"
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(event) => {
            setText(event.currentTarget.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            submit()
          }}
        />
        <span className="saga-lore-era-label" aria-label="Era">
          {'year' in parsed ? (eraOf(calendar, parsed.year)?.short ?? '') : ''}
        </span>
        <button type="button" className="mod-cta" onClick={submit}>
          Set year
        </button>
      </div>
      {error ? (
        <p role="alert" className="saga-header-hint">
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

function MonthPicker({ calendar, value, onPick }: PickerProps) {
  const [year, setYear] = useState(value && 'year' in value ? value.year : 1)
  const titleId = useId()
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

function DayPicker({ calendar, value, onPick }: PickerProps) {
  const [view, setView] = useState(() => (value && 'year' in value ? { year: value.year, month: Math.min(Math.max(value.month ?? 1, 1), calendar.months.length) } : { year: 1, month: 1 }))
  const titleId = useId()
  const move = (months: number) => (): void => setView(addMonths(calendar, view, months))
  const columns = calendar.weekdays.length
  return (
    <div>
      <Nav
        title={formatDate(calendar, view)}
        titleId={titleId}
        back={[
          { label: 'Previous year', icon: 'chevrons-left', on: move(-calendar.months.length) },
          { label: 'Previous month', icon: 'chevron-left', on: move(-1) }
        ]}
        forward={[
          { label: 'Next month', icon: 'chevron-right', on: move(1) },
          { label: 'Next year', icon: 'chevrons-right', on: move(calendar.months.length) }
        ]}
      />
      <div role="group" aria-labelledby={titleId} className="saga-lore-days" ref={(el) => el?.setCssProps({ '--saga-lore-columns': String(columns) })}>
        {calendar.weekdays.map((weekday, i) => (
          <span key={i} className="saga-lore-weekday" title={weekday} aria-hidden="true">
            {weekday.slice(0, 2)}
          </span>
        ))}
        {monthGrid(calendar, view.year, view.month)
          .flat()
          .map((day) => (
            <button
              key={`${day.year}-${day.month}-${day.day}`}
              type="button"
              className="saga-lore-day"
              data-outside={day.inMonth ? undefined : ''}
              aria-label={formatDate(calendar, day)}
              aria-pressed={value !== undefined && 'year' in value && value.year === day.year && value.month === day.month && value.day === day.day}
              onClick={() => onPick({ year: day.year, month: day.month, day: day.day })}
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
 * Without a calendar the popover asks for one first. Choosing calls `onChange`; Escape or a click outside closes the popover with nothing written.
 */
export function DateEditor({ field, value, onChange, id, invalid, describedBy, calendar }: EditorProps<'date'> & EditorCtx) {
  const { env, file } = useHeader()
  const [open, setOpen] = useState(false)
  const [precision, setPrecision] = useState<Precision>(() => precisionOf(value))
  const [alignEnd, setAlignEnd] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLDivElement>(null)

  // A popover that would run past the card opens towards the left.
  useLayoutEffect(() => {
    if (!open || !root.current || !popover.current) return
    const card = root.current.closest('.saga-header')?.getBoundingClientRect()
    setAlignEnd(card !== undefined && root.current.getBoundingClientRect().left + popover.current.offsetWidth > card.right)
  }, [open, precision])

  useEffect(() => {
    if (!open) return
    const doc = root.current?.ownerDocument
    const away = (event: PointerEvent): void => {
      const target = event.target
      if (target instanceof Element && !root.current?.contains(target) && !target.closest('.suggestion-container')) setOpen(false)
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
  const picker: PickerProps | undefined = range ? { calendar: range, value, onPick: pick } : undefined
  const target = calendar.file ? linktextOf(env.app, calendar.file, file.path) : ''

  return (
    <span
      ref={root}
      className="saga-lore-date"
      data-empty={value ? undefined : ''}
      onBlur={(event) => {
        const next = event.relatedTarget
        if (next instanceof Element && !root.current?.contains(next) && !next.closest('.suggestion-container')) setOpen(false)
      }}
    >
      <button
        ref={trigger}
        id={id}
        type="button"
        className="saga-lore-date-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => {
          if (!open) setPrecision(precisionOf(value))
          setOpen(!open)
        }}
      >
        <Icon name={value ? 'calendar' : 'plus'} />
        {value ? formatDate(range ?? NO_CALENDAR, value) : field.prefix === '' ? 'Set date' : 'Add end'}
      </button>
      {value ? <RemoveButton label={field.label} onClick={() => onChange(undefined)} /> : null}
      {open ? (
        <div
          ref={popover}
          role="dialog"
          aria-label={`${field.label} date`}
          className="saga-lore-popover"
          data-align={alignEnd ? 'end' : undefined}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            event.stopPropagation()
            close()
          }}
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
              {precision === 'Era' ? <EraList {...picker} /> : precision === 'Year' ? <YearPicker {...picker} /> : precision === 'Month' ? <MonthPicker {...picker} /> : <DayPicker {...picker} />}
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
      ) : null}
    </span>
  )
}
