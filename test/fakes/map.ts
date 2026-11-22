import type { App, TFile } from 'obsidian'
import { CONFIG_PATH, createConfigStore, type ConfigStore } from '../../src/obsidian/vault'
import type { MapState } from '../../src/map/types'
import { createHost, type HostUi, type MapHost } from '../../src/map/host'
import type { MenuAt, MenuItem } from '../../src/ui/menu'
import { mapStateOf } from '../../src/map/mapState'
import { FakeApp } from './obsidian'

export const MAP = 'Maps/The Shattered Coast.md'
export const MAP_NOTE = '---\ntype: map\nimage: "[[coast.svg]]"\n---\n# The Shattered Coast\n\nA map.\n'
export const SALTMERE = '---\ntype: settlement\nmap-pins:\n  - map: "[[The Shattered Coast]]"\n    x: 790\n    y: 500\n---\nA harbour town that taxes the tide.\n'
export const HESK = '---\ntype: NPC\n---\nHesk, the rumour-monger.\n'
export const GULL =
  '---\ntype: NPC\nmap-pins:\n  - map: "[[The Shattered Coast]]"\n    x: 300\n    y: 590\n    style: danger\n    note: keep\n  - map: "[[Elsewhere]]"\n    x: 1\n    y: 1\n---\nThe Gull King.\n'
export const BRINE = '---\ntype: settlement\nmap-pins:\n  - map: "[[The Shattered Coast]]"\n    x: 846\n    y: 556\n    style: sparkly\n---\nDungeon.\n'
export const CONFIG_YAML = 'typeKey: type\nrenderers:\n  character:\n    types: [character, NPC]\n  location:\n    types: [location, settlement]\n  map:\n    types: [map]\n'

/** A 1400 x 900 image the browser can load. */
export const MAP_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900"><rect width="1400" height="900" fill="#cdd"/></svg>')}`

/** `FakeApp` with the parts of `App` the map uses beyond it: link text, resource URL, and a controllable write. */
class MapApp extends FakeApp {
  constructor() {
    super()
    Object.assign(this.metadataCache, {
      fileToLinktext: (file: TFile): string => (this.metadataCache.getFirstLinkpathDest(file.basename) === file ? file.basename : file.path.replace(/\.md$/, ''))
    })
    this.vault.getResourcePath = () => MAP_IMAGE
    Object.assign(this.vault, { cachedRead: (file: TFile): Promise<string> => this.vault.read(file) })
  }
}

/** A map view over a fake vault: the state the Bases view would render, recomputed when a note changes, and a scripted Obsidian UI. */
export class MapFake {
  /** Notes of the base, in order. */
  readonly base: string[] = []
  readonly options: Record<string, unknown> = { map: MAP }
  /** The Pin labels setting. */
  pinLabels: 'always' | 'hover' = 'always'
  /** Whether Obsidian runs on a phone or tablet. */
  mobile = false
  /** Menus the view opened, newest last. */
  readonly menus: { at: MenuAt; items: MenuItem[] }[] = []
  readonly notices: string[] = []
  readonly hovered: string[] = []
  readonly prompts: string[] = []
  pickCalls = 0
  /** Answers the note picker; null cancels. */
  pick: () => Promise<TFile | null> = () => Promise.resolve(null)
  /** Answers the icon picker; null cancels. */
  icon: () => Promise<string | null> = () => Promise.resolve(null)
  confirm = true
  /** While true the view keeps showing the data it last had, as when the base has not re-queried yet. */
  frozen = false
  private last: MapState | null = null
  private cached: { path: string; host: MapHost } | null = null

  private constructor(
    readonly fake: MapApp,
    readonly settings: ConfigStore
  ) {}

  static async create(): Promise<MapFake> {
    const fake = new MapApp()
    fake.setRaw(CONFIG_PATH, CONFIG_YAML)
    const map = new MapFake(fake, await createConfigStore(fake.asApp(), fake.owner()))
    fake.addFile('Attachments/coast.svg')
    map.addNote(MAP, MAP_NOTE)
    map.addNote('Places/Saltmere.md', SALTMERE)
    map.addNote('People/The Gull King.md', GULL)
    map.addNote('Places/The Brine Vaults.md', BRINE)
    map.addNote('People/Mother Hesk.md', HESK)
    return map
  }

  get app(): App {
    return this.fake.asApp()
  }

  file(path: string): TFile {
    const file = this.app.vault.getFileByPath(path)
    if (!file) throw new Error(`no file ${path}`)
    return file
  }

  text(path: string): string {
    return this.fake.text(path)
  }

  /** Adds a note; `inBase: false` keeps it out of the base's entries. */
  addNote(path: string, text: string, inBase = true): TFile {
    const file = this.fake.addFile(path, text)
    if (inBase && !this.base.includes(path)) this.base.push(path)
    return file
  }

  /** The state the view renders now. */
  state(): MapState {
    if (this.frozen && this.last) return this.last
    this.last = mapStateOf(this.app, this.settings, {
      option: (key) => this.options[key],
      pinLabels: this.pinLabels,
      mobile: this.mobile,
      files: () => this.base.map((path) => this.file(path)),
      host: (map) => {
        if (this.cached?.path !== map.path) this.cached = { path: map.path, host: createHost(this.app, map, this.ui()) }
        return this.cached.host
      }
    })
    return this.last
  }

  private ui(): HostUi {
    return {
        pickNote: () => {
          this.pickCalls++
          return this.pick()
        },
        pickIcon: () => this.icon(),
        confirmRemove: (pin) => {
          this.prompts.push(`Remove this pin from ${pin.file.name}?`)
          return Promise.resolve(this.confirm)
        },
        notify: (message) => void this.notices.push(message),
        hoverNote: (_event, _target, file) => void this.hovered.push(file.path),
        showMenu: (at, items) => void this.menus.push({ at, items })
    }
  }

  /** Calls `callback` when a note changes; returns the unsubscribe. */
  subscribe(callback: () => void): () => void {
    const ref = this.fake.metadataCache.on('changed', () => {
      if (!this.frozen) callback()
    })
    return () => this.fake.metadataCache.offref(ref)
  }

  /** Chooses an item of the newest menu by title, as a click would. */
  choose(title: string): void {
    const item = this.menus.at(-1)?.items.find((candidate) => candidate.title === title)
    if (!item) throw new Error(`no menu item ${title}`)
    item.onClick()
  }

  /** Holds every write until the returned function is called. */
  holdWrites(): () => void {
    const real = this.fake.vault.process
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    this.fake.vault.process = async (file, fn) => {
      await gate
      return real(file, fn)
    }
    return () => {
      release()
    }
  }

  /** Makes every write fail with `message`. */
  failWrites(message: string): void {
    this.fake.vault.process = () => Promise.reject(new Error(message))
  }

  get writes(): readonly string[] {
    return this.fake.processed
  }

  get opened(): FakeApp['opened'] {
    return this.fake.opened
  }
}
