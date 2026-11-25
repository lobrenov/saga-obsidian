import { BasesView, Notice, type HoverPopover, type QueryController, type TFile } from 'obsidian'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { noteCalendar } from '../header/noteCalendar'
import { confirm } from '../map/modals'
import { frontmatterOf, type ConfigStore } from '../obsidian/vault'
import { readDate } from '../shared/calendars/dates'
import { calendarStateOf } from './calendarState'
import { CalendarRoot } from './CalendarRoot'
import { EditEntryModal } from './editModal'
import { deleteEntry, entryNoun, saveEntry } from './entryActions'
import { createHost, type CalendarHost, type HostUi } from './host'

export const CALENDAR_VIEW_ID = 'saga-calendar'
export const HOVER_SOURCE = 'saga-calendar'

/** The Bases view that shows the base's notes dated on the chosen calendar note. */
export class CalendarBasesView extends BasesView {
  readonly type = CALENDAR_VIEW_ID
  hoverPopover: HoverPopover | null = null
  private readonly rootEl: HTMLElement
  private readonly root: Root
  private cached: { path: string; host: CalendarHost } | null = null

  constructor(
    controller: QueryController,
    containerEl: HTMLElement,
    private readonly settings: ConfigStore,
    private readonly showMenu: CalendarHost['showMenu']
  ) {
    super(controller)
    containerEl.addClass('saga-calview-container')
    this.rootEl = containerEl.createDiv({ cls: 'saga-calview-view' })
    this.root = createRoot(this.rootEl)
    this.register(settings.subscribe(() => this.onDataUpdated()))
  }

  onDataUpdated(): void {
    if (!this.data) return
    const state = calendarStateOf(this.app, this.settings, {
      option: (key) => this.config.get(key),
      files: () => this.data.data.map((entry) => entry.file),
      host: (calendar) => this.hostFor(calendar),
      setOption: (key, value) => this.config.set(key, value)
    })
    this.root.render(createElement(CalendarRoot, { state }))
  }

  override onunload(): void {
    this.root.unmount()
    this.rootEl.remove()
  }

  private hostFor(calendar: TFile): CalendarHost {
    if (this.cached?.path !== calendar.path) {
      const ui: HostUi = {
        showMenu: this.showMenu,
        hoverNote: (event, target, file) =>
          this.app.workspace.trigger('hover-link', { event, source: HOVER_SOURCE, hoverParent: this, targetEl: target, linktext: file.path, sourcePath: calendar.path }),
        editEntry: (entry) => {
          const config = this.settings.state().config
          const frontmatter = frontmatterOf(this.app, entry.file)
          const onCalendar = noteCalendar(this.app, entry.file, config, entry.renderer, frontmatter)
          const initial = { title: entry.file.basename, when: readDate(frontmatter, '').value, end: readDate(frontmatter, 'end-').value }
          new EditEntryModal(this.app, {
            config,
            file: entry.file,
            renderer: entry.renderer,
            noun: entryNoun(entry),
            calendar: onCalendar,
            initial,
            onSave: (draft) => saveEntry(this.app, entry.file, initial, draft, onCalendar.calendar)
          }).open()
        },
        deleteEntry: (entry) =>
          void deleteEntry(this.app, entry.file, entryNoun(entry), (title, message, action, cancel) => confirm(this.app, title, message, action, cancel)).catch(
            (error: unknown) => new Notice(`Could not delete ${entry.file.basename}: ${error instanceof Error ? error.message : String(error)}`)
          )
      }
      this.cached = { path: calendar.path, host: createHost(this.app, calendar, ui) }
    }
    return this.cached.host
  }
}
