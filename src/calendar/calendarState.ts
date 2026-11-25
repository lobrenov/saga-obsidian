import type { App, TFile } from 'obsidian'
import { frontmatterOf, resolveLink, type ConfigStore } from '../obsidian/vault'
import { parseCalendar } from '../shared/calendars/schema'
import { collectEntries } from './entries'
import type { CalendarHost } from './host'
import type { CalendarState, Display } from './types'

/** What the Bases view supplies: its option values, the notes of the base, and the host of a calendar. */
export interface CalendarViewInput {
  option: (key: string) => unknown
  files: () => TFile[]
  /** The host of a calendar note; the view keeps it while the note is unchanged. */
  host: (calendar: TFile) => CalendarHost
  setOption: (key: string, value: string) => void
}

/** Whether the note is a calendar under the current config (its type resolves to the `calendar` renderer). */
export const isCalendarNote = (app: App, settings: ConfigStore, file: TFile): boolean => file.extension === 'md' && settings.rendererOf(frontmatterOf(app, file)).renderer === 'calendar'

const DISPLAYS: readonly Display[] = ['calendar', 'feed', 'timeline']

/** What the view shows: the chosen calendar with the base's entries on it, or why there is no calendar. */
export function calendarStateOf(app: App, settings: ConfigStore, input: CalendarViewInput): CalendarState {
  const empty = (message: string, issues: string[] = []): CalendarState => ({ kind: 'empty', message, issues })
  const path = input.option('calendar')
  if (typeof path !== 'string' || path === '') return empty('Choose a calendar note in the view options.')
  const file = app.vault.getFileByPath(path) ?? resolveLink(app, path.startsWith('[[') ? path : `[[${path}]]`, '')
  if (!file) return empty(`${path} is not in the vault.`)
  if (!isCalendarNote(app, settings, file)) return empty(`${file.basename} is not a calendar note.`)
  const parsed = parseCalendar(frontmatterOf(app, file))
  if (!parsed.value) return empty(`${file.basename} is not a valid calendar.`, parsed.issues.map((issue) => `${issue.path}: ${issue.message}`))
  const display = input.option('display')
  return {
    kind: 'calendar',
    host: input.host(file),
    file,
    title: file.basename,
    calendar: parsed.value,
    entries: collectEntries(app, settings, input.files(), file, parsed.value),
    display: DISPLAYS.find((id) => id === display) ?? 'calendar',
    opens: input.option('opens') === 'year' ? 'year' : 'month',
    setOption: input.setOption
  }
}
