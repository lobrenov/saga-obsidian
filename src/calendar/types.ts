import type { TFile } from 'obsidian'
import type { Calendar } from '../shared/calendars/schema'
import type { CalendarEntry } from './entries'
import type { CalendarHost } from './host'

export type Display = 'calendar' | 'feed' | 'timeline'
export type Range = 'month' | 'year'

export type CalendarState =
  | { kind: 'empty'; message: string; issues: string[] }
  | {
      kind: 'calendar'
      host: CalendarHost
      /** The calendar note. */
      file: TFile
      title: string
      calendar: Calendar
      entries: readonly CalendarEntry[]
      display: Display
      /** The range the Calendar display opens on. */
      opens: Range
      /** Writes a view option. */
      setOption: (key: string, value: string) => void
    }
