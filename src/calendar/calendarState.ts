import type { App, TFile } from 'obsidian'
import { frontmatterOf, isRendererNote, resolveLink, type ConfigStore } from '../obsidian/vault'
import { parseCalendar } from '../shared/calendars/schema'
import type { Issue } from '../shared/result'
import { collectEntries } from './entries'
import type { CalendarHost } from './host'
import type { CalendarState, Display, Scale } from './types'

/** What the Bases view supplies: its option values, the notes of the base, and the host of a calendar. */
export interface CalendarViewInput {
  option: (key: string) => unknown
  files: () => TFile[]
  /** The host of a calendar note; the view keeps it while the note is unchanged. */
  host: (calendar: TFile) => CalendarHost
  setOption: (key: string, value: string) => void
}

/** Whether the note is a calendar under the current config (its type resolves to the `calendar` renderer). */
export const isCalendarNote = (app: App, settings: ConfigStore, file: TFile): boolean => isRendererNote(app, (frontmatter) => settings.rendererOf(frontmatter), 'calendar')(file)

const DISPLAYS: readonly Display[] = ['calendar', 'feed', 'timeline']
const SCALES: readonly Scale[] = ['all', 'century', 'decade', 'year']

/** What the view shows: the chosen calendar with the base's entries on it, or why there is no calendar. */
export function calendarStateOf(app: App, settings: ConfigStore, input: CalendarViewInput): CalendarState {
  const empty = (message: string, issues: string[] = [], link?: TFile): CalendarState => ({ kind: 'empty', message, issues, ...(link && { link: { file: link, host: input.host(link) } }) })
  const path = input.option('calendar')
  if (typeof path !== 'string' || path === '') return empty('Choose a calendar note in the view options.')
  const file = app.vault.getFileByPath(path) ?? resolveLink(app, path.startsWith('[[') ? path : `[[${path}]]`, '')
  if (!file) return empty(`${path} is not in the vault.`)
  if (!isCalendarNote(app, settings, file)) return empty(`${file.basename} is not a calendar note.`, [], file)
  const frontmatter = frontmatterOf(app, file)
  const parsed = parseCalendar(frontmatter)
  const describe = (issue: Issue): string => `${issue.path}: ${frontmatter[issue.path.split('.')[0] ?? ''] == null ? 'Not set' : issue.message}`
  if (!parsed.value) return empty(`${file.basename} is not a valid calendar.`, parsed.issues.map(describe), file)
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
    scale: SCALES.find((id) => id === input.option('scale')) ?? 'all',
    order: input.option('feed-order') === 'newest' ? 'newest' : 'oldest',
    banners: input.option('banners') !== false,
    setOption: input.setOption
  }
}
