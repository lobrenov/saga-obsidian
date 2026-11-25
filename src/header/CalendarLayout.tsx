import { useId, useLayoutEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import type { App, TFile } from 'obsidian'
import { frontmatterOf, resolveLink, setField } from '../obsidian/vault'
import { addYears, dateRange, dayNumber, eraSpan, formatDate, readDate, weekdayOf, type CalendarDate } from '../shared/calendars/dates'
import { parseCalendar, type Calendar } from '../shared/calendars/schema'
import type { Issue } from '../shared/result'
import { MenuSelect } from '../ui/MenuSelect'
import { CommitInput } from './CommitInput'
import { useHeader } from './env'
import { Icon } from './Icon'
import type { LayoutInput } from './types'
import { useReorder } from './useReorder'

const STRIP_OPEN_WEIGHT = 300
const NEW_ERA_STEP = 100
const SIDES = [
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' }
]

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const shown = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? String(value) : '')
const read = (entry: unknown, key: string): string => shown(isRecord(entry) ? entry[key] : undefined)
const patch = (entry: unknown, changes: Record<string, unknown>): Record<string, unknown> => ({ ...(isRecord(entry) ? entry : {}), ...changes })
const replaceAt = <T,>(items: readonly T[], index: number, item: T): T[] => items.map((existing, i) => (i === index ? item : existing))
const withoutAt = <T,>(items: readonly T[], index: number): T[] => items.filter((_, i) => i !== index)
const moved = <T,>(items: readonly T[], from: number, to: number): T[] => {
  const next = [...items]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}
const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

/** The first era of each side has no start. */
const withoutFirstStarts = (eras: unknown[]): unknown[] => {
  const seen = new Set<string>()
  return eras.map((era) => {
    const side = read(era, 'side')
    if (seen.has(side)) return era
    seen.add(side)
    return isRecord(era) && 'start' in era ? { ...era, start: undefined } : era
  })
}

/** The notes whose `calendar` link resolves to `file`, with their start and end dates. */
function loreOf(app: App, file: TFile): { start: CalendarDate; end: CalendarDate | undefined }[] {
  return app.vault.getMarkdownFiles().flatMap((note) => {
    const frontmatter = frontmatterOf(app, note)
    const link = frontmatter['calendar']
    if (typeof link !== 'string' || resolveLink(app, link, note.path)?.path !== file.path) return []
    const start = readDate(frontmatter, '').value
    return start ? [{ start, end: readDate(frontmatter, 'end-').value }] : []
  })
}

/** The notes of `file`'s calendar whose `era` or `end-era` is `era`. */
const notesInEra = (app: App, file: TFile, era: string): TFile[] =>
  app.vault.getMarkdownFiles().filter((note) => {
    const frontmatter = frontmatterOf(app, note)
    const link = frontmatter['calendar']
    return typeof link === 'string' && resolveLink(app, link, note.path)?.path === file.path && (frontmatter['era'] === era || frontmatter['end-era'] === era)
  })

function Issues({ issues }: { issues: Issue[] }) {
  return (
    <>
      {issues.map((issue, i) => (
        <p key={i} className="saga-header-hint saga-calendar-issue">
          {issue.message}
        </p>
      ))}
    </>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="saga-calendar-section">
      <div className="saga-calendar-section-head">
        <h2 id={id} className="saga-header-label">
          {title}
        </h2>
        {note ? <span className="saga-calendar-note">{note}</span> : null}
      </div>
      {children}
    </section>
  )
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="saga-calendar-add-row" onClick={onClick}>
      <Icon name="plus" />
      {label}
    </button>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="saga-calendar-remove" aria-label={label} onClick={onClick}>
      <Icon name="x" />
    </button>
  )
}

/** The calendar note's header body: months, week, eras, the era strip and a year at a glance. Each control writes one key's whole value. */
export function CalendarLayout({ title, frontmatter }: LayoutInput) {
  const { env, file } = useHeader()
  const { app } = env
  const [error, setError] = useState<string | null>(null)
  const [addingDay, setAddingDay] = useState(false)

  const months = list(frontmatter['months'])
  const weekdays = list(frontmatter['weekdays'])
  const eras = list(frontmatter['eras'])
  const firstWeekday = read(frontmatter, 'first-weekday')
  const { value: calendar, issues } = parseCalendar(frontmatter)
  const issuesAt = (path: string): Issue[] => issues.filter((issue) => issue.path === path || issue.path.startsWith(`${path}.`))
  const invalidAt = (path: string): boolean => issues.some((issue) => issue.path === path)

  const write = async (key: string, value: unknown): Promise<boolean> => {
    const result = await setField(app, file, key, value)
    setError(result.ok ? null : `Could not update “${key}”: ${result.error.message}`)
    return result.ok
  }
  const writeEras = (next: unknown[]): Promise<boolean> => write('eras', withoutFirstStarts(next))
  const number = (text: string): number | null => (text.trim() === '' || Number.isNaN(Number(text)) ? null : Number(text))

  const renameEra = async (index: number, text: string): Promise<boolean> => {
    const name = text.trim()
    const old = read(eras[index], 'name')
    if (name === old) return false
    const notes = old && name ? notesInEra(app, file, old) : []
    if (notes.length > 0 && !(await env.confirm('Rename era', `Rename ${old} to ${name} in ${plural(notes.length, 'note')}?`, 'Rename', 'Cancel'))) return false
    await writeEras(replaceAt(eras, index, patch(eras[index], { name })))
    const failed: string[] = []
    for (const note of notes) {
      const current = frontmatterOf(app, note)
      for (const key of ['era', 'end-era']) {
        if (current[key] !== old) continue
        const result = await setField(app, note, key, name)
        if (!result.ok && !failed.includes(note.basename)) failed.push(note.basename)
      }
    }
    if (failed.length > 0) env.notify(`Could not rename ${old} in ${failed.join(', ')}`)
    return true
  }

  const addEra = (): Promise<boolean> => {
    const side = read(eras.at(-1), 'side') === 'before' ? 'before' : 'after'
    const starts = eras.filter((era) => read(era, 'side') === side).map((era) => Number(read(era, 'start')))
    const last = starts.filter((start) => !Number.isNaN(start) && start > 0).at(-1)
    const first = starts.length === 0
    const start = first ? undefined : side === 'after' ? (last ?? 1) + NEW_ERA_STEP : last ? Math.max(1, Math.floor(last / 2)) : NEW_ERA_STEP
    return writeEras([...eras, { name: 'New era', short: 'NE', side, ...(start !== undefined && { start }) }])
  }

  const monthOrder = useReorder((from, to) => void write('months', moved(months, from, to)))
  const weekdayOrder = useReorder((from, to) => void write('weekdays', moved(weekdays, from, to)))
  const eraOrder = useReorder((from, to) => void writeEras(moved(eras, from, to)))

  const days = months.reduce<number>((total, month) => total + (Number(read(month, 'days')) || 0), 0)
  const firstOfSide = eras.map((era, i) => !eras.slice(0, i).some((earlier) => read(earlier, 'side') === read(era, 'side')))
  const weekdayId = useId()

  return (
    <>
      <div className="saga-header-identity">
        {title}
        <p className="saga-calendar-summary">
          {[plural(months.length, 'month'), `${plural(days, 'day')} a year`, `${weekdays.length}-day week`, plural(eras.length, 'era')].join(' · ')}
        </p>
      </div>
      <div className="saga-calendar-body">
        <div className="saga-calendar-main">
          <Section title="Months" note="Drag to reorder">
            <div className="saga-calendar-table" data-columns="months">
              <div className="saga-calendar-head" aria-hidden="true">
                <span />
                <span>#</span>
                <span>Name</span>
                <span>Days</span>
                <span />
              </div>
              {months.map((month, i) => {
                const name = read(month, 'name') || `month ${i + 1}`
                const rowIssues = issuesAt(`months.${i}`)
                return (
                  <div key={i} className="saga-calendar-row" data-over={monthOrder.over === i || undefined} {...monthOrder.row(i)}>
                    <span className="saga-calendar-grip" aria-hidden="true" {...monthOrder.grip(i)}>
                      <Icon name="grip-vertical" />
                    </span>
                    <span className="saga-calendar-number">{i + 1}</span>
                    <CommitInput
                      className="saga-calendar-quiet"
                      aria-label={`Month ${i + 1} name`}
                      aria-invalid={invalidAt(`months.${i}.name`) || undefined}
                      value={read(month, 'name')}
                      onCommit={(text) => write('months', replaceAt(months, i, patch(month, { name: text.trim() })))}
                    />
                    <CommitInput
                      type="number"
                      className="saga-calendar-days"
                      aria-label={`${name} days`}
                      aria-invalid={invalidAt(`months.${i}.days`) || undefined}
                      value={read(month, 'days')}
                      onCommit={(text) => {
                        const days = number(text)
                        return days === null ? false : write('months', replaceAt(months, i, patch(month, { days })))
                      }}
                    />
                    <RemoveButton label={`Remove ${name}`} onClick={() => void write('months', withoutAt(months, i))} />
                    <Issues issues={rowIssues} />
                  </div>
                )
              })}
              <AddRow label="Add month" onClick={() => void write('months', [...months, { name: 'New month', days: 30 }])} />
            </div>
            <Issues issues={issues.filter((issue) => issue.path === 'months')} />
          </Section>

          <Section title="Week">
            <ul className="saga-header-chips">
              {weekdays.map((weekday, i) => (
                <li key={i} className="saga-header-chip saga-calendar-chip" data-over={weekdayOrder.over === i || undefined} {...weekdayOrder.row(i)} {...weekdayOrder.grip(i)}>
                  <span className="saga-calendar-chip-name">{shown(weekday)}</span>
                  <button type="button" className="saga-header-chip-action" aria-label={`Remove ${shown(weekday)}`} onClick={() => void write('weekdays', withoutAt(weekdays, i))}>
                    <Icon name="x" />
                  </button>
                </li>
              ))}
              <li>
                {addingDay ? (
                  <CommitInput
                    className="saga-header-input"
                    aria-label="Weekday name"
                    placeholder="Day name"
                    value=""
                    autoFocus
                    onBlur={() => setAddingDay(false)}
                    onCommit={(text) => (text.trim() === '' ? undefined : write('weekdays', [...weekdays, text.trim()]))}
                  />
                ) : (
                  <button type="button" className="saga-header-add" onClick={() => setAddingDay(true)}>
                    <Icon name="plus" />
                    Add day
                  </button>
                )}
              </li>
            </ul>
            <Issues issues={issuesAt('weekdays')} />
            <p className="saga-calendar-first">
              <label htmlFor={weekdayId}>Year 1 began on</label>
              <MenuSelect
                id={weekdayId}
                value={firstWeekday}
                placeholder={firstWeekday || 'Choose a day'}
                invalid={invalidAt('first-weekday')}
                options={weekdays.map((weekday) => ({ value: shown(weekday), label: shown(weekday) }))}
                showMenu={env.showMenu}
                onChange={(value) => void write('first-weekday', value)}
              />
            </p>
            <Issues issues={issuesAt('first-weekday')} />
          </Section>

          <Section title="Eras" note="In order, earliest first · years count back before year 1 and up from it">
            <div className="saga-calendar-table" data-columns="eras">
              <div className="saga-calendar-head" aria-hidden="true">
                <span />
                <span>Side</span>
                <span>Name</span>
                <span>Short</span>
                <span>Starts</span>
                <span />
              </div>
              {eras.map((era, i) => {
                const name = read(era, 'name') || `era ${i + 1}`
                const side = read(era, 'side')
                return (
                  <div key={i} className="saga-calendar-row" data-side={side} data-over={eraOrder.over === i || undefined} {...eraOrder.row(i)}>
                    <span className="saga-calendar-grip" aria-hidden="true" {...eraOrder.grip(i)}>
                      <Icon name="grip-vertical" />
                    </span>
                    <MenuSelect
                      label={`${name} side`}
                      value={side}
                      placeholder="Side"
                      invalid={invalidAt(`eras.${i}.side`)}
                      options={SIDES}
                      showMenu={env.showMenu}
                      onChange={(value) => void writeEras(replaceAt(eras, i, patch(era, { side: value })))}
                    />
                    <CommitInput
                      className="saga-calendar-field"
                      aria-label={`Era ${i + 1} name`}
                      aria-invalid={invalidAt(`eras.${i}.name`) || undefined}
                      value={read(era, 'name')}
                      onCommit={(text) => renameEra(i, text)}
                    />
                    <CommitInput
                      className="saga-calendar-field saga-calendar-short"
                      aria-label={`${name} short name`}
                      aria-invalid={invalidAt(`eras.${i}.short`) || undefined}
                      value={read(era, 'short')}
                      onCommit={(text) => writeEras(replaceAt(eras, i, patch(era, { short: text.trim() })))}
                    />
                    {firstOfSide[i] && (side === 'before' || side === 'after') ? (
                      <span className="saga-calendar-fixed">{side === 'before' ? 'Earliest' : 'Year 1'}</span>
                    ) : (
                      <span className="saga-calendar-start">
                        <CommitInput
                          type="number"
                          className="saga-calendar-field"
                          aria-label={`${name} starts`}
                          aria-invalid={invalidAt(`eras.${i}.start`) || undefined}
                          value={read(era, 'start')}
                          onCommit={(text) => {
                            const start = number(text)
                            return start === null ? false : writeEras(replaceAt(eras, i, patch(era, { start })))
                          }}
                        />
                        <span className="saga-calendar-number">{read(era, 'short')}</span>
                      </span>
                    )}
                    <RemoveButton label={`Remove ${name}`} onClick={() => void writeEras(withoutAt(eras, i))} />
                    <Issues issues={issuesAt(`eras.${i}`)} />
                  </div>
                )
              })}
              <AddRow label="Add era" onClick={() => void addEra()} />
            </div>
            <Issues issues={issues.filter((issue) => issue.path === 'eras')} />
            {calendar ? <EraStrip calendar={calendar} /> : null}
          </Section>
          {error ? (
            <p role="alert" className="saga-header-hint">
              {error}
            </p>
          ) : null}
        </div>
        {calendar ? <Glance calendar={calendar} /> : null}
      </div>
    </>
  )
}

/** The eras in sequence, each as wide as its span (open eras at a fixed weight). */
function EraStrip({ calendar }: { calendar: Calendar }) {
  const before = calendar.eras.filter((era) => era.side === 'before')
  const after = calendar.eras.filter((era) => era.side === 'after')
  const names = [...before.map((era) => era.name), 'then year 1', ...after.map((era) => era.name)]
  return (
    <div className="saga-calendar-strip-wrap">
      <div className="saga-calendar-strip" role="img" aria-label={`Eras in sequence: ${names.join(', ')}`}>
        {calendar.eras.map((era, i) => {
          const { from, to } = eraSpan(calendar, era)
          const weight = Number.isFinite(from) && Number.isFinite(to) ? to - from + 1 : STRIP_OPEN_WEIGHT
          return (
            <span
              key={i}
              className="saga-calendar-era"
              data-side={era.side}
              data-year-one={from === 1 || undefined}
              ref={(el) => el?.setCssProps({ '--saga-calendar-weight': String(weight) })}
            >
              {era.name} · {era.short}
            </span>
          )
        })}
      </div>
      <div className="saga-calendar-strip-caption" aria-hidden="true">
        <span>← counting back</span>
        <span>year 1</span>
        <span>counting up →</span>
      </div>
    </div>
  )
}

/** One year as a small grid per month, with the days that notes of this calendar are dated on marked. */
function Glance({ calendar }: { calendar: Calendar }) {
  const { env, file } = useHeader()
  const { app } = env
  const [tick, reload] = useReducer((n: number) => n + 1, 0)
  const lore = useMemo(() => loreOf(app, file), [app, file.path, tick])
  const [year, setYear] = useState(() => lore.reduce<number | null>((first, { start }) => ('year' in start && (first === null || start.year < first) ? start.year : first), null) ?? 1)

  useLayoutEffect(() => {
    let timer: number | undefined
    const ref = app.metadataCache.on('changed', () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(reload, 250)
    })
    return () => {
      window.clearTimeout(timer)
      app.metadataCache.offref(ref)
    }
  }, [app])

  // Days of notes dated to the day, from start to end when both are days.
  const ranges = useMemo(
    () =>
      lore.flatMap(({ start, end }) => {
        if (!('year' in start) || start.day === undefined) return []
        const from = dateRange(calendar, start).from
        const last = end && 'year' in end && end.day !== undefined ? dateRange(calendar, end).to : from
        return [{ from, to: Math.max(from, last) }]
      }),
    [lore, calendar]
  )
  const id = useId()
  return (
    <aside aria-labelledby={id} className="saga-calendar-glance">
      <div className="saga-calendar-glance-head">
        <h2 id={id} className="saga-header-label">
          {formatDate(calendar, { year })} at a glance
        </h2>
        <button type="button" className="saga-calendar-step" aria-label="Previous year" onClick={() => setYear(addYears(year, -1))}>
          <Icon name="chevron-left" />
        </button>
        <button type="button" className="saga-calendar-step" aria-label="Next year" onClick={() => setYear(addYears(year, 1))}>
          <Icon name="chevron-right" />
        </button>
      </div>
      <div className="saga-calendar-months">
        {calendar.months.map((month, m) => (
          <div key={m} className="saga-calendar-month">
            <p className="saga-calendar-month-head">
              <span>{month.name}</span>
              <span>{month.days}</span>
            </p>
            <div className="saga-calendar-cells" aria-hidden="true" ref={(el) => el?.setCssProps({ '--saga-calendar-week': String(calendar.weekdays.length) })}>
              {Array.from({ length: weekdayOf(calendar, year, m + 1, 1) }, (_, i) => (
                <span key={`lead-${i}`} className="saga-calendar-day" data-blank="" />
              ))}
              {Array.from({ length: month.days }, (_, d) => {
                const n = dayNumber(calendar, year, m + 1, d + 1)
                const marked = ranges.some((range) => range.from <= n && n <= range.to)
                return <span key={d} className="saga-calendar-day" data-day={d + 1} data-lore={marked || undefined} />
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="saga-calendar-legend">
        <span className="saga-calendar-day" data-lore="" aria-hidden="true" />
        Days with lore
      </p>
    </aside>
  )
}
