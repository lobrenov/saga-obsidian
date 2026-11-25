import type { App, TFile } from 'obsidian'
import { frontmatterOf, isRendererNote, resolveLink } from '../obsidian/vault'
import type { Calendar } from '../shared/calendars/schema'
import { parseCalendar } from '../shared/calendars/schema'
import { rendererDefs } from '../shared/renderers/definitions'
import type { Fields } from '../shared/renderers/fields'
import type { RendererId } from '../shared/renderers/ids'
import { createRendererResolver } from '../shared/renderers/resolve'
import type { Issue } from '../shared/result'
import type { Config } from '../shared/schemas/config'

/** A calendar that has no months, weekdays or eras, for showing a date whose calendar is missing. */
export const NO_CALENDAR: Calendar = { months: [], weekdays: [], 'first-weekday': '', eras: [] }

/** The calendar a dated note is on. */
export interface NoteCalendar {
  /** The key the note's calendar link is written under. */
  key: string
  /** The note the link resolves to, else the vault's only calendar note; null when there is none to use. */
  file: TFile | null
  /** `file` is the vault's only calendar note and the note does not link it yet. */
  implicit: boolean
  /** The calendar read from `file`; undefined without a file or when it is invalid. */
  calendar: Calendar | undefined
  issues: Issue[]
}

/** Whether a note is drawn by the calendar renderer under `config`. */
export function calendarFilter(app: App, config: Config): (file: TFile) => boolean {
  return isRendererNote(app, createRendererResolver(config), 'calendar')
}

/** The calendar a note of `renderer` is on: the note its calendar link resolves to; with no link, the only calendar note in the vault. */
export function noteCalendar(app: App, file: TFile, config: Config, renderer: RendererId, frontmatter: Readonly<Record<string, unknown>>): NoteCalendar {
  const fields: Fields = rendererDefs[renderer].fields
  const key = config.renderers[renderer]?.keys['calendar'] ?? fields['calendar']?.key ?? 'calendar'
  const link = frontmatter[key]
  const linked = typeof link === 'string' ? resolveLink(app, link, file.path) : null
  const only = link === undefined || link === null || link === '' ? app.vault.getMarkdownFiles().filter(calendarFilter(app, config)) : []
  const target = linked ?? (only.length === 1 ? (only[0] ?? null) : null)
  const parsed = target ? parseCalendar(frontmatterOf(app, target)) : undefined
  return { key, file: target, implicit: linked === null && target !== null, calendar: parsed?.value, issues: parsed?.issues ?? [] }
}

/** The key Lore notes keep their calendar link under. */
export const loreCalendarKey = (config: Config): string => config.renderers.lore?.keys['calendar'] ?? rendererDefs.lore.fields.calendar.key
