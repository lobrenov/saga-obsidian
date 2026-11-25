import type { App, TFile } from 'obsidian'
import { loreCalendarKey } from '../header/noteCalendar'
import { frontmatterOf, linksTo, resolveLink, resourceUrl, type ConfigStore } from '../obsidian/vault'
import { checkDate, compareDates, readDate, type CalendarDate } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import { bannerOf } from '../shared/renderers/banner'
import { rendererDefs } from '../shared/renderers/definitions'
import type { RendererId } from '../shared/renderers/ids'
import type { Issue } from '../shared/result'

/** A note of the base dated on the chosen calendar. */
export interface CalendarEntry {
  file: TFile
  /** The note's file name without extension. */
  title: string
  renderer: RendererId
  /** The note's type as written; null without one. */
  type: string | null
  /** Undefined when the note's start date is invalid for the calendar. */
  start: CalendarDate | undefined
  /** Undefined without an end, or when the end is invalid or before the start. */
  end: CalendarDate | undefined
  issues: string[]
  /** The note's banner image URL and vertical position in percent, when it has a banner that resolves. */
  banner: { url: string; y: number } | undefined
}

const describe = (issues: Issue[]): string[] => issues.map((issue) => `${issue.path}: ${issue.message}`)

/** The entries on `calendar` from the date keys of `files`: notes whose `calendar` link resolves (from the note holding it) to the calendar note. A note with no date and no issue is left out. */
export function collectEntries(app: App, config: ConfigStore, files: readonly TFile[], file: TFile, calendar: Calendar): CalendarEntry[] {
  const entries: CalendarEntry[] = []
  const key = loreCalendarKey(config.state().config)
  for (const note of files) {
    if (note.extension !== 'md' || note.path === file.path) continue
    const frontmatter = frontmatterOf(app, note)
    const { renderer, type } = config.rendererOf(frontmatter)
    if (!linksTo(app, file, note, frontmatter, key)) continue

    const read = readDate(frontmatter, '')
    const issues = [...read.issues]
    let start = read.value
    const startIssues = start ? checkDate(calendar, start) : []
    if (startIssues.length > 0) {
      issues.push(...startIssues)
      start = undefined
    }

    const readEnd = readDate(frontmatter, 'end-')
    issues.push(...readEnd.issues)
    let end = readEnd.value
    const endIssues = end ? checkDate(calendar, end, 'end-') : []
    if (endIssues.length > 0) {
      issues.push(...endIssues)
      end = undefined
    }
    if (start && end && compareDates(calendar, end, start) < 0) {
      issues.push({ path: 'end', message: 'Ends before it starts' })
      end = undefined
    }

    if (!start && issues.length === 0 && end) issues.push({ path: 'end', message: 'Ends without When' })
    if (!start && issues.length === 0) continue
    const banner = bannerOf(rendererDefs[renderer], config.state().config.renderers[renderer]?.keys ?? {}, frontmatter)
    const image = banner.link ? resolveLink(app, banner.link, note.path) : null
    entries.push({ file: note, title: note.basename, renderer, type, start, end: start ? end : undefined, issues: describe(issues), banner: image ? { url: resourceUrl(app, image), y: banner.y } : undefined })
  }
  return entries
}
