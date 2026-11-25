import type { App, TFile } from 'obsidian'
import { setFields } from '../obsidian/vault'
import { checkDate, dateKeyNames, dateKeys, dateRange, type CalendarDate } from '../shared/calendars/dates'
import type { Calendar } from '../shared/calendars/schema'
import { rendererDefs } from '../shared/renderers/definitions'
import type { CalendarEntry } from './entries'

/** What the edit dialog changes: the note's name and its dates. */
export interface EntryDraft {
  title: string
  when: CalendarDate | undefined
  end: CalendarDate | undefined
}

/** The entry's kind in menus and the dialog: its type as written (lowercased unless all capitals), else its renderer's label. */
export function entryNoun(entry: Pick<CalendarEntry, 'type' | 'renderer'>): string {
  const type = entry.type ?? rendererDefs[entry.renderer].label
  return type === type.toUpperCase() ? type : type.toLowerCase()
}

const same = (a: CalendarDate | undefined, b: CalendarDate | undefined): boolean => JSON.stringify(a) === JSON.stringify(b)

/** The keys that write `date` under `prefix`, or remove it, with finer and era keys removed. */
function keysOf(date: CalendarDate | undefined, prefix: string): Record<string, unknown> {
  const { write, remove } = date ? dateKeys(date, prefix) : { write: {}, remove: dateKeyNames(prefix) }
  return { ...write, ...Object.fromEntries(remove.map((key) => [key, undefined])) }
}

/**
 * Renames the note when its title changed, then writes the dates that changed in one write.
 * Returns the reason nothing was written (an empty or clashing title, Ends before When) or why a write failed; null when saved.
 */
export async function saveEntry(app: App, file: TFile, before: EntryDraft, after: EntryDraft, calendar: Calendar | undefined): Promise<string | null> {
  const name = after.title.trim()
  if (name === '') return 'The title cannot be empty'
  if (/[\\/:*"<>?|]/.test(name)) return 'The title cannot contain \\ / : * " < > ? or |'
  const { when, end } = after
  if (calendar && when && end && checkDate(calendar, when).length === 0 && checkDate(calendar, end).length === 0 && dateRange(calendar, end).to < dateRange(calendar, when).from)
    return 'Ends cannot be earlier than When'
  const folder = file.parent && file.parent.path !== '/' ? `${file.parent.path}/` : ''
  const path = `${folder}${name}.${file.extension}`
  // A name that differs from another note's only in case clashes with it.
  if (name !== file.basename && app.vault.getMarkdownFiles().some((other) => other !== file && other.path.toLowerCase() === path.toLowerCase())) return `${name} already exists`

  // The rename goes first, so a refused name writes nothing.
  if (name !== file.basename) {
    try {
      await app.fileManager.renameFile(file, path)
    } catch (error) {
      return `Could not rename the note: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  const keys = { ...(same(before.when, when) ? {} : keysOf(when, '')), ...(same(before.end, end) ? {} : keysOf(end, 'end-')) }
  if (Object.keys(keys).length > 0) {
    const result = await setFields(app, file, keys)
    if (!result.ok) return `Could not update the dates: ${result.error.message}`
  }
  return null
}

/** Asks, then moves the note to the trash Obsidian's Deleted files setting names. */
export async function deleteEntry(app: App, file: TFile, noun: string, confirm: (title: string, message: string, action: string, cancel: string) => Promise<boolean>): Promise<void> {
  if (await confirm(`Delete ${noun}`, `Delete “${file.basename}”?`, 'Delete', 'Cancel')) await app.fileManager.trashFile(file)
}
