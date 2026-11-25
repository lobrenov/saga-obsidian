import type { App, BasesAllOptions, BasesViewConfig } from 'obsidian'
import type { ConfigStore } from '../obsidian/vault'
import { isCalendarNote } from './calendarState'

/** The view options: the calendar note and the display, then the options of the chosen display only. */
export function calendarOptions(app: App, config: ConfigStore, view: BasesViewConfig): BasesAllOptions[] {
  const notShowing = (display: string) => (): boolean => (view.get('display') ?? 'calendar') !== display
  return [
    { type: 'file', key: 'calendar', displayName: 'Calendar note', placeholder: 'A note of type calendar', filter: (file) => isCalendarNote(app, config, file) },
    { type: 'dropdown', key: 'display', displayName: 'Display as', default: 'calendar', options: { calendar: 'Calendar', feed: 'Feed', timeline: 'Timeline' } },
    { type: 'dropdown', key: 'opens', displayName: 'Opens on', default: 'month', options: { month: 'Month', year: 'Year' }, shouldHide: notShowing('calendar') },
    { type: 'dropdown', key: 'order', displayName: 'Order', default: 'oldest', options: { oldest: 'Oldest first', newest: 'Newest first' }, shouldHide: notShowing('feed') },
    { type: 'toggle', key: 'banners', displayName: 'Banners', default: true, shouldHide: notShowing('feed') },
    { type: 'dropdown', key: 'scale', displayName: 'Scale', default: 'all', options: { all: 'All', century: 'Century', decade: 'Decade', year: 'Year' }, shouldHide: notShowing('timeline') }
  ]
}
