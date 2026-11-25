import { BasesView, type HoverPopover, type QueryController, type TFile } from 'obsidian'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ConfigStore } from '../obsidian/vault'
import { calendarStateOf } from './calendarState'
import { CalendarRoot } from './CalendarRoot'
import { createHost, type CalendarHost } from './host'

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
      const ui = {
        showMenu: this.showMenu,
        hoverNote: (event: MouseEvent, target: HTMLElement, file: TFile) =>
          this.app.workspace.trigger('hover-link', { event, source: HOVER_SOURCE, hoverParent: this, targetEl: target, linktext: file.path, sourcePath: calendar.path })
      }
      this.cached = { path: calendar.path, host: createHost(this.app, calendar, ui) }
    }
    return this.cached.host
  }
}
