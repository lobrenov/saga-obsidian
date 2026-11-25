import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { App, TFile } from 'obsidian'
import { frontmatterOf, linksTo, setField, updateField } from '../obsidian/vault'
import { eraSpan, readDate, type CalendarDate } from '../shared/calendars/dates'
import { parseCalendar, type Calendar } from '../shared/calendars/schema'
import type { Issue } from '../shared/result'
import { MenuSelect } from '../ui/MenuSelect'
import { CommitInput } from './CommitInput'
import { useHeader } from './env'
import { RemoveButton } from './fieldEditors'
import { Icon } from './Icon'
import type { LayoutInput } from './types'
import { loreCalendarKey } from './noteCalendar'
import { useReorder } from './useReorder'

const STRIP_OPEN_WEIGHT = 300
const NEW_ERA_STEP = 100
const SIDES = [
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' }
]
const ATTACHED = /^(months|weekdays|first-weekday|eras)(\.|$)/

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

/** Where `entry` (as drawn) is in `items` as written now; its drawn index when it was edited meanwhile. */
const locate = (items: unknown[], entry: unknown, drawn: number): number => {
  const text = JSON.stringify(entry)
  const at = items.findIndex((item) => JSON.stringify(item) === text)
  return at < 0 ? drawn : at
}

/** The notes whose `calendar` link resolves to `file`, with their start and end dates. */
export function loreOf(app: App, file: TFile, key = 'calendar'): { path: string; start: CalendarDate; end: CalendarDate | undefined }[] {
  return app.vault.getMarkdownFiles().flatMap((note) => {
    const frontmatter = frontmatterOf(app, note)
    if (!linksTo(app, file, note, frontmatter, key)) return []
    const start = readDate(frontmatter, '').value
    return start ? [{ path: note.path, start, end: readDate(frontmatter, 'end-').value }] : []
  })
}

/** The notes of `file`'s calendar whose `era` or `end-era` is `era`. */
const notesInEra = (app: App, file: TFile, era: string, key: string): TFile[] =>
  app.vault.getMarkdownFiles().filter((note) => {
    const frontmatter = frontmatterOf(app, note)
    return linksTo(app, file, note, frontmatter, key) && (frontmatter['era'] === era || frontmatter['end-era'] === era)
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
    <div className="saga-calendar-add-row">
      <button type="button" className="saga-header-add" onClick={onClick}>
        <Icon name="plus" />
        {label}
      </button>
    </div>
  )
}

/** The handle of a reorderable row: drag it, open its menu, or press Alt+ArrowUp or Alt+ArrowDown. */
function Grip({ name, index, count, order, onMove }: { name: string; index: number; count: number; order: ReturnType<typeof useReorder>; onMove: (from: number, to: number) => void }) {
  const { env } = useHeader()
  const button = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    if (order.focus !== index) return
    button.current?.focus()
    order.focusAt(null)
  })
  return (
    <button
      ref={button}
      type="button"
      className="saga-calendar-grip"
      aria-label={`Move ${name}`}
      aria-haspopup="menu"
      {...order.grip(index)}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect()
        const items = [
          ...(index > 0 ? [{ title: 'Move up', icon: 'arrow-up', onClick: () => onMove(index, index - 1) }] : []),
          ...(index < count - 1 ? [{ title: 'Move down', icon: 'arrow-down', onClick: () => onMove(index, index + 1) }] : [])
        ]
        if (items.length > 0) env.showMenu({ x: box.left, y: box.bottom }, items)
      }}
      onKeyDown={(event) => {
        if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
        event.preventDefault()
        const to = index + (event.key === 'ArrowUp' ? -1 : 1)
        if (to < 0 || to >= count) return
        order.focusAt(to)
        onMove(index, to)
      }}
    >
      <Icon name="grip-vertical" />
    </button>
  )
}

/** The input that adds a weekday: Enter adds and stays open for the next, Escape or an empty blur closes it. */
function AddDay({ onAdd, onClose }: { onAdd: (name: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => input.current?.focus(), [])
  const add = (): void => {
    const name = draft.trim()
    setDraft('')
    if (name !== '') onAdd(name)
  }
  return (
    <input
      ref={input}
      type="text"
      className="saga-header-input"
      aria-label="Weekday name"
      placeholder="Day name"
      autoComplete="off"
      spellCheck={false}
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        add()
        onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          add()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          setDraft('')
          onClose()
        }
      }}
    />
  )
}

/** The calendar note's header body: months, week, eras, and the era strip. Each control writes one key's whole value, built from the value in the note at write time. */
export function CalendarLayout({ title, frontmatter }: LayoutInput) {
  const { env, file, config } = useHeader()
  const { app } = env
  const loreKey = loreCalendarKey(config)
  const [error, setError] = useState<string | null>(null)
  const [addingDay, setAddingDay] = useState(false)

  const months = list(frontmatter['months'])
  const weekdays = list(frontmatter['weekdays'])
  const eras = list(frontmatter['eras'])
  const firstWeekday = read(frontmatter, 'first-weekday')
  const parsed = parseCalendar(frontmatter)
  const calendar = parsed.value
  // Issues of the keys the note has.
  const issues = parsed.issues.filter((issue) => frontmatter[issue.path.split('.')[0] ?? ''] != null)
  const issuesAt = (path: string): Issue[] => issues.filter((issue) => issue.path === path || issue.path.startsWith(`${path}.`))
  const invalidAt = (path: string): boolean => issues.some((issue) => issue.path === path)

  const report = (key: string, result: { ok: true } | { ok: false; error: { message: string } }): boolean => {
    setError(result.ok ? null : `Could not update “${key}”: ${result.error.message}`)
    return result.ok
  }
  /** Replaces the key's list with `change` of the list as written now. */
  const edit = async (key: string, change: (items: unknown[]) => unknown[]): Promise<boolean> => report(key, await updateField(app, file, key, (current) => change(list(current))))
  /** Applies `changes` to the entry (as drawn at `index`) as written now. */
  const editEntry = (key: string, items: unknown[], index: number, changes: Record<string, unknown>): Promise<boolean> =>
    edit(key, (current) => {
      const at = locate(current, items[index], index)
      return replaceAt(current, at, patch(current[at], changes))
    })
  const removeEntry = (key: string, items: unknown[], index: number): Promise<boolean> => edit(key, (current) => withoutAt(current, locate(current, items[index], index)))
  const moveEntry = (key: string, items: unknown[]) => (from: number, to: number): void =>
    void edit(key, (current) => moved(current, locate(current, items[from], from), locate(current, items[to], to)))
  const number = (text: string): number | null => (text.trim() === '' || Number.isNaN(Number(text)) ? null : Number(text))

  const renameEra = async (index: number, text: string): Promise<boolean> => {
    const name = text.trim()
    const old = read(eras[index], 'name')
    if (name === old) return false
    const notes = old && name ? notesInEra(app, file, old, loreKey) : []
    if (notes.length > 0 && !(await env.confirm('Rename era', `Rename ${old} to ${name} in ${plural(notes.length, 'note')}?`, 'Rename', 'Cancel'))) return false
    if (!(await editEntry('eras', eras, index, { name }))) return false
    const failed: string[] = []
    for (const note of notes) {
      const current = frontmatterOf(app, note)
      for (const key of ['era', 'end-era'].filter((key) => current[key] === old)) {
        const result = await updateField(app, note, key, (value) => (value === old ? name : value))
        if (!result.ok && !failed.includes(note.basename)) failed.push(note.basename)
      }
    }
    if (failed.length > 0) env.notify(`Could not rename ${old} in ${failed.join(', ')}`)
    return true
  }

  const addEra = (): Promise<boolean> =>
    edit('eras', (current) => {
      const side = read(current.at(-1), 'side') === 'before' ? 'before' : 'after'
      const sameSide = current.filter((era) => read(era, 'side') === side)
      const last = sameSide
        .map((era) => Number(read(era, 'start')))
        .filter((start) => !Number.isNaN(start) && start > 0)
        .at(-1)
      const start = sameSide.length === 0 ? undefined : side === 'after' ? (last ?? 1) + NEW_ERA_STEP : last ? Math.max(1, Math.floor(last / 2)) : NEW_ERA_STEP
      // The first number whose name and short name no era has: New era / NE, then New era 2 / NE2.
      const taken = (key: string, value: string): boolean => current.some((era) => read(era, key) === value)
      let n = 1
      const suffix = (separator: string): string => (n === 1 ? '' : `${separator}${n}`)
      while (taken('name', `New era${suffix(' ')}`) || taken('short', `NE${suffix('')}`)) n++
      return [...current, { name: `New era${suffix(' ')}`, short: `NE${suffix('')}`, side, ...(start !== undefined && { start }) }]
    })

  const monthOrder = useReorder(moveEntry('months', months))
  const weekdayOrder = useReorder(moveEntry('weekdays', weekdays))
  const eraOrder = useReorder(moveEntry('eras', eras))

  const days = months.reduce<number>((total, month) => total + (Number(read(month, 'days')) || 0), 0)
  const firstOfSide = eras.map((era, i) => !eras.slice(0, i).some((earlier) => read(earlier, 'side') === read(era, 'side')))
  const weekdayId = useId()
  const summary = [
    months.length > 0 && plural(months.length, 'month'),
    days > 0 && `${plural(days, 'day')} a year`,
    weekdays.length > 0 && `${weekdays.length}-day week`,
    eras.length > 0 && plural(eras.length, 'era')
  ].filter(Boolean)

  return (
    <>
      <div className="saga-header-identity">
        {title}
        {months.length > 0 ? <p className="saga-calendar-summary">{summary.join(' · ')}</p> : null}
        <Issues issues={issues.filter((issue) => !ATTACHED.test(issue.path))} />
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
                return (
                  <div key={i} className="saga-calendar-row" data-over={monthOrder.over === i || undefined} {...monthOrder.row(i)}>
                    <Grip name={name} index={i} count={months.length} order={monthOrder} onMove={moveEntry('months', months)} />
                    <span className="saga-calendar-number">{i + 1}</span>
                    <CommitInput
                      className="saga-calendar-quiet"
                      aria-label={`${name} name`}
                      aria-invalid={invalidAt(`months.${i}.name`) || undefined}
                      value={read(month, 'name')}
                      onCommit={(text) => editEntry('months', months, i, { name: text.trim() })}
                    />
                    <CommitInput
                      type="number"
                      className="saga-calendar-days"
                      aria-label={`${name} days`}
                      aria-invalid={invalidAt(`months.${i}.days`) || undefined}
                      value={read(month, 'days')}
                      onCommit={(text) => {
                        const value = number(text)
                        return value === null ? false : editEntry('months', months, i, { days: value })
                      }}
                    />
                    <RemoveButton label={name} onClick={() => void removeEntry('months', months, i)} />
                    <Issues issues={issuesAt(`months.${i}`)} />
                  </div>
                )
              })}
              <AddRow label="Add month" onClick={() => void edit('months', (current) => [...current, { name: 'New month', days: 30 }])} />
            </div>
            <Issues issues={issues.filter((issue) => issue.path === 'months')} />
          </Section>

          <Section title="Week">
            <ul className="saga-header-chips">
              {weekdays.map((weekday, i) => (
                <li key={i} className="saga-header-chip saga-calendar-chip" data-over={weekdayOrder.over === i || undefined} {...weekdayOrder.row(i)}>
                  <Grip name={shown(weekday)} index={i} count={weekdays.length} order={weekdayOrder} onMove={moveEntry('weekdays', weekdays)} />
                  <span className="saga-calendar-chip-name">{shown(weekday)}</span>
                  <RemoveButton label={shown(weekday)} onClick={() => void removeEntry('weekdays', weekdays, i)} />
                </li>
              ))}
              <li>
                {addingDay ? (
                  <AddDay onAdd={(name) => void edit('weekdays', (current) => [...current, name])} onClose={() => setAddingDay(false)} />
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
                onChange={(value) => void setField(app, file, 'first-weekday', value).then((result) => report('first-weekday', result))}
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
                    <Grip name={name} index={i} count={eras.length} order={eraOrder} onMove={moveEntry('eras', eras)} />
                    <MenuSelect
                      label={`${name} side`}
                      value={side}
                      placeholder="Side"
                      invalid={invalidAt(`eras.${i}.side`)}
                      options={SIDES}
                      showMenu={env.showMenu}
                      onChange={(value) => void editEntry('eras', eras, i, { side: value })}
                    />
                    <CommitInput
                      className="saga-calendar-field"
                      aria-label={`${name} name`}
                      aria-invalid={invalidAt(`eras.${i}.name`) || undefined}
                      value={read(era, 'name')}
                      onCommit={(text) => renameEra(i, text)}
                    />
                    <CommitInput
                      className="saga-calendar-field saga-calendar-short"
                      aria-label={`${name} short name`}
                      aria-invalid={invalidAt(`eras.${i}.short`) || undefined}
                      value={read(era, 'short')}
                      onCommit={(text) => editEntry('eras', eras, i, { short: text.trim() })}
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
                            return start === null ? false : editEntry('eras', eras, i, { start })
                          }}
                        />
                        <span className="saga-calendar-number">{read(era, 'short')}</span>
                      </span>
                    )}
                    <RemoveButton label={name} onClick={() => void removeEntry('eras', eras, i)} />
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
              title={era.name}
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
        {before.length > 0 ? <span>← counting back</span> : null}
        <span>year 1</span>
        {after.length > 0 ? <span>counting up →</span> : null}
      </div>
    </div>
  )
}
