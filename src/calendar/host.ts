import type { App, TFile } from 'obsidian'
import type { ShowMenu } from '../ui/menu'

/** What the display asks of its surroundings; `HostUi` is the part that opens Obsidian UI. */
export interface CalendarHost {
  openNote(file: TFile, newTab: boolean): void
  /** The note's text. */
  excerpt(file: TFile): Promise<string>
  hoverNote(event: MouseEvent, target: HTMLElement, file: TFile): void
  showMenu: ShowMenu
}

export type HostUi = Pick<CalendarHost, 'hoverNote' | 'showMenu'>

/** The host of one calendar over the vault; notes open relative to the calendar note. */
export function createHost(app: App, calendar: TFile, ui: HostUi): CalendarHost {
  return {
    ...ui,
    openNote: (file, newTab) => void app.workspace.openLinkText(file.path, calendar.path, newTab ? 'tab' : false),
    excerpt: (file) => app.vault.cachedRead(file)
  }
}
