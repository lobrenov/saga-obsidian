import type { Plugin } from 'obsidian'
import type { ConfigStore } from '../obsidian/vault'
import { showMenu } from '../ui/menu'
import './calendar.css'
import { CALENDAR_VIEW_ID, CalendarBasesView, HOVER_SOURCE } from './CalendarBasesView'
import { calendarOptions } from './options'

/** Registers the Saga calendar Bases view and its hover-preview source. */
export function registerCalendarView(plugin: Plugin, config: ConfigStore): void {
  plugin.registerHoverLinkSource(HOVER_SOURCE, { display: 'Saga calendar', defaultMod: true })
  plugin.registerBasesView(CALENDAR_VIEW_ID, {
    name: 'Saga calendar',
    icon: 'calendar-days',
    factory: (controller, containerEl) => new CalendarBasesView(controller, containerEl, config, showMenu),
    options: (view) => calendarOptions(plugin.app, config, view)
  })
}
