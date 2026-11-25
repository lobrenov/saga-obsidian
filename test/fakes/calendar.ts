import type { App, TFile } from 'obsidian'
import { calendarStateOf } from '../../src/calendar/calendarState'
import { createHost, type CalendarHost } from '../../src/calendar/host'
import type { CalendarState } from '../../src/calendar/types'
import { CONFIG_PATH, createConfigStore, type ConfigStore } from '../../src/obsidian/vault'
import type { MenuAt, MenuItem } from '../../src/ui/menu'
import { FakeApp } from './obsidian'

export const CAL = 'Worlds/The Tidereckoning.md'
export const CALENDAR_NOTE =
  '---\ntype: calendar\nmonths:\n  - { name: Thawmoon, days: 30 }\n  - { name: Seedtide, days: 28 }\n  - { name: Highsun, days: 30 }\nweekdays: [Moonday, Tideday, Netday, Saltday, Lampday, Restday]\nfirst-weekday: Moonday\neras:\n  - { name: The Drowned Age, short: BL, side: before }\n  - { name: Age of Lanterns, short: AL, side: after }\n---\nThe Tidereckoning.\n'
export const OTHER_CAL = 'Worlds/Elsewhere.md'
export const CONFIG_YAML = 'typeKey: type\nrenderers:\n  calendar:\n    types: [calendar]\n  lore:\n    types: [lore, event]\n  character:\n    types: [character]\n'

/** A Lore note on The Tidereckoning with `keys` as extra frontmatter lines. */
export const lore = (keys: string, body = '', calendar = 'The Tidereckoning'): string => `---\ntype: event\ncalendar: "[[${calendar}]]"\n${keys}\n---\n${body}`

class CalendarApp extends FakeApp {
  constructor() {
    super()
    Object.assign(this.vault, { cachedRead: (file: TFile): Promise<string> => this.vault.read(file) })
  }
}

/** A Saga calendar view over a fake vault: the state the Bases view would render, recomputed when a note changes, and a scripted Obsidian UI. */
export class CalendarFake {
  /** Notes of the base, in order. */
  readonly base: string[] = []
  readonly options: Record<string, unknown> = { calendar: CAL }
  /** Option writes of the view's controls, in order. */
  readonly written: [string, string][] = []
  readonly menus: { at: MenuAt; items: MenuItem[]; parent?: HTMLElement | undefined }[] = []
  readonly hovered: string[] = []
  private cached: { path: string; host: CalendarHost } | null = null
  private readonly listeners = new Set<() => void>()

  private constructor(
    readonly fake: CalendarApp,
    readonly settings: ConfigStore
  ) {}

  static async create(): Promise<CalendarFake> {
    const fake = new CalendarApp()
    fake.setRaw(CONFIG_PATH, CONFIG_YAML)
    const calendar = new CalendarFake(fake, await createConfigStore(fake.asApp(), fake.owner()))
    calendar.addNote(CAL, CALENDAR_NOTE)
    calendar.addNote(OTHER_CAL, CALENDAR_NOTE)
    return calendar
  }

  get app(): App {
    return this.fake.asApp()
  }

  file(path: string): TFile {
    const file = this.app.vault.getFileByPath(path)
    if (!file) throw new Error(`no file ${path}`)
    return file
  }

  /** Adds a note; `inBase: false` keeps it out of the base's entries. */
  addNote(path: string, text: string, inBase = true): TFile {
    const existing = this.app.vault.getFileByPath(path)
    if (existing) existing.stat.mtime++
    const file = this.fake.addFile(path, text)
    if (inBase && !this.base.includes(path)) this.base.push(path)
    return file
  }

  /** The state the view renders now. */
  state(): CalendarState {
    return calendarStateOf(this.app, this.settings, {
      option: (key) => this.options[key],
      files: () => this.base.map((path) => this.file(path)),
      host: (calendar) => {
        if (this.cached?.path !== calendar.path) {
          const ui = { showMenu: (at: MenuAt, items: MenuItem[], parent?: HTMLElement) => {
            parent?.classList.add('has-active-menu')
            this.menus.push({ at, items, parent })
          }, hoverNote: (_event: MouseEvent, _target: HTMLElement, file: TFile) => void this.hovered.push(file.path) }
          this.cached = { path: calendar.path, host: createHost(this.app, calendar, ui) }
        }
        return this.cached.host
      },
      setOption: (key, value) => {
        this.written.push([key, value])
        this.set(key, value)
      }
    })
  }

  /** Sets a view option and has the view render again, as Bases does for a config change. */
  set(key: string, value: unknown): void {
    this.options[key] = value
    this.listeners.forEach((listener) => listener())
  }

  /** Calls `callback` when a note changes or an option is set; returns the unsubscribe. */
  subscribe(callback: () => void): () => void {
    const ref = this.fake.metadataCache.on('changed', callback)
    this.listeners.add(callback)
    return () => {
      this.fake.metadataCache.offref(ref)
      this.listeners.delete(callback)
    }
  }

  /** Chooses an item of the newest menu by title and closes the menu, as a click would. */
  choose(title: string): void {
    const menu = this.menus.at(-1)
    const item = menu?.items.find((candidate) => candidate.title === title)
    if (!item) throw new Error(`no menu item ${title}`)
    item.onClick()
    menu?.parent?.classList.remove('has-active-menu')
  }

  get opened(): FakeApp['opened'] {
    return this.fake.opened
  }
}
