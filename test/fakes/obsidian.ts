import type { App, Component as ObsidianComponent, TFile as ObsidianTFile } from 'obsidian'
import { parseFrontmatter } from '../../src/shared/frontmatter'

type Listener = (...args: unknown[]) => unknown
export interface EventRef {
  events: Events
  name: string
  fn: Listener
}

export class Events {
  private readonly listeners = new Map<string, Set<Listener>>()

  on(name: string, fn: Listener): EventRef {
    const set = this.listeners.get(name) ?? new Set<Listener>()
    set.add(fn)
    this.listeners.set(name, set)
    return { events: this, name, fn }
  }

  off(name: string, fn: Listener): void {
    this.listeners.get(name)?.delete(fn)
  }

  offref(ref: EventRef): void {
    this.off(ref.name, ref.fn)
  }

  trigger(name: string, ...args: unknown[]): void {
    this.listeners.get(name)?.forEach((fn) => fn(...args))
  }
}

export class Component {
  private readonly cleanups: (() => void)[] = []
  private readonly children: Component[] = []

  load(): void {}

  unload(): void {
    this.children.forEach((child) => child.unload())
    this.cleanups.splice(0).forEach((cleanup) => cleanup())
  }

  addChild<T extends Component>(child: T): T {
    this.children.push(child)
    return child
  }

  register(cleanup: () => void): void {
    this.cleanups.push(cleanup)
  }

  registerEvent(ref: EventRef): void {
    this.register(() => ref.events.offref(ref))
  }

  registerDomEvent(): void {}
  registerInterval(): number {
    return 0
  }
}

/** A child of a rendered section; `unload` runs `onunload`, as Obsidian's does. */
export class MarkdownRenderChild extends Component {
  constructor(public containerEl: HTMLElement) {
    super()
  }

  onunload(): void {}

  override unload(): void {
    super.unload()
    this.onunload()
  }
}

export class Plugin extends Component {
  constructor(
    public app: App,
    public manifest: { id: string }
  ) {
    super()
  }

  onload(): void | Promise<void> {}
  onunload(): void {}
}

export class TAbstractFile {
  constructor(public path: string) {}
  get name(): string {
    return this.path.slice(this.path.lastIndexOf('/') + 1)
  }
}

export class TFile extends TAbstractFile {
  get extension(): string {
    const dot = this.name.lastIndexOf('.')
    return dot < 0 ? '' : this.name.slice(dot + 1)
  }
  get basename(): string {
    const dot = this.name.lastIndexOf('.')
    return dot < 0 ? this.name : this.name.slice(0, dot)
  }
}

/** Link resolution as Obsidian's: a path (with or without `.md`) matches exactly, else the first file with that name. */
function resolvePath(files: Iterable<TFile>, linkpath: string): TFile | null {
  const all = [...files].sort((a, b) => a.path.localeCompare(b.path))
  const withExt = /\.[^/.]+$/.test(linkpath) ? linkpath : `${linkpath}.md`
  return all.find((file) => file.path === withExt) ?? all.find((file) => file.path.endsWith(`/${withExt}`) || file.name === withExt) ?? null
}

/** Stand-ins for Obsidian's editor state fields, for modules that import them. */
export const editorInfoField = {}
export const editorLivePreviewField = {}

/** Icon ids `getIcon` does not know, as Obsidian answers for an id missing from its Lucide. */
export const unknownIcons = new Set<string>()

/** An `<svg data-icon>` holding a `<path data-icon>` for the id (browser tests only); null for an id in `unknownIcons`. */
export function getIcon(id: string): SVGSVGElement | null {
  if (unknownIcons.has(id)) return null
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.dataset.icon = id
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.dataset.icon = id
  svg.append(path)
  return svg
}

export function setIcon(el: HTMLElement, id: string): void {
  el.dataset.icon = id
}

/** A suggestion modal over `getItems()` matching `getItemText` by substring; `open`/`close` track state, `choose` selects as a click does. */
export abstract class FuzzySuggestModal<T> {
  isOpen = false
  placeholder = ''
  constructor(public app: App) {}
  abstract getItems(): T[]
  abstract getItemText(item: T): string
  abstract onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void
  renderSuggestion(match: { item: T }, el: HTMLElement): void {
    el.textContent = this.getItemText(match.item)
  }
  setPlaceholder(text: string): void {
    this.placeholder = text
  }
  suggestions(query = ''): T[] {
    return this.getItems().filter((item) => this.getItemText(item).toLowerCase().includes(query.toLowerCase()))
  }
  choose(item: T): void {
    this.onChooseItem(item, new MouseEvent('click'))
    this.close()
  }
  open(): void {
    this.isOpen = true
  }
  close(): void {
    this.isOpen = false
  }
}

/** The slice of Obsidian's `App` the plugin uses, over in-memory files; cast with `asApp()`. */
export class FakeApp {
  private readonly texts = new Map<string, string>()
  private readonly files = new Map<string, TFile>()
  private readonly rawTexts = new Map<string, string>()
  /** Paths rewritten by `vault.process`, one entry per changing write. */
  readonly processed: string[] = []
  readonly opened: { linktext: string; sourcePath: string; newLeaf: unknown }[] = []

  readonly vault = Object.assign(new Events(), {
    adapter: {
      exists: (path: string): Promise<boolean> => Promise.resolve(this.rawTexts.has(path) || [...this.rawTexts.keys()].some((key) => key.startsWith(`${path}/`))),
      read: (path: string): Promise<string> => {
        const text = this.rawTexts.get(path)
        return text === undefined ? Promise.reject(new Error(`ENOENT: ${path}`)) : Promise.resolve(text)
      },
      write: (path: string, text: string): Promise<void> => {
        this.setRaw(path, text)
        return Promise.resolve()
      },
      mkdir: (): Promise<void> => Promise.resolve()
    },
    getResourcePath: (file: TFile): string => `app://local/${encodeURIComponent(file.path)}`,
    read: (file: TFile): Promise<string> => Promise.resolve(this.text(file.path)),
    readBinary: (file: TFile): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode(this.text(file.path)).buffer),
    getMarkdownFiles: (): TFile[] => [...this.files.values()].filter((file) => file.extension === 'md'),
    getFileByPath: (path: string): TFile | null => this.files.get(path) ?? null,
    process: (file: TFile, fn: (data: string) => string): Promise<string> => {
      const next = fn(this.text(file.path))
      if (next !== this.text(file.path)) {
        this.processed.push(file.path)
        this.setText(file.path, next)
        this.vault.trigger('modify', file)
      }
      return Promise.resolve(next)
    }
  })

  readonly metadataCache = Object.assign(new Events(), {
    getFileCache: (file: TFile): { frontmatter?: Record<string, unknown> } | null => {
      const parsed = parseFrontmatter(this.text(file.path))
      return Object.keys(parsed.data).length > 0 ? { frontmatter: { ...parsed.data, position: {} } } : {}
    },
    getFirstLinkpathDest: (linkpath: string): TFile | null => resolvePath(this.files.values(), linkpath),
    fileToLinktext: (file: TFile, _from: string, omitMdExtension = true): string => {
      const unique = [...this.files.values()].filter((other) => other.basename === file.basename).length === 1
      const name = unique ? file.basename : file.path.replace(/\.md$/, '')
      return omitMdExtension || file.extension !== 'md' ? name : `${name}.md`
    }
  })

  readonly workspace = Object.assign(new Events(), {
    getLeavesOfType: (): unknown[] => [],
    onLayoutReady: (callback: () => void): void => callback(),
    openLinkText: (linktext: string, sourcePath: string, newLeaf?: unknown): Promise<void> => {
      this.opened.push({ linktext, sourcePath, newLeaf })
      return Promise.resolve()
    }
  })

  readonly fileManager = {}

  /** Adds (or replaces) a note or attachment and returns its file. */
  addFile(path: string, text = ''): ObsidianTFile {
    const file = this.files.get(path) ?? new TFile(path)
    this.files.set(path, file)
    this.setText(path, text)
    return file as unknown as ObsidianTFile
  }

  /** The current text of a file, or of a dot-folder file added with `setRaw`. */
  text(path: string): string {
    return this.texts.get(path) ?? this.rawTexts.get(path) ?? ''
  }

  /** Writes a file that is not indexed (inside a dot-folder) and fires the `raw` event. */
  setRaw(path: string, text: string): void {
    this.rawTexts.set(path, text)
    this.vault.trigger('raw', path)
  }

  /** Removes a file that is not indexed and fires the `raw` event. */
  deleteRaw(path: string): void {
    this.rawTexts.delete(path)
    this.vault.trigger('raw', path)
  }

  /** A component to own event registrations; `unload()` removes them. */
  owner(): ObsidianComponent {
    return new Component() as unknown as ObsidianComponent
  }

  asApp(): App {
    return this as unknown as App
  }

  private setText(path: string, text: string): void {
    this.texts.set(path, text)
    this.metadataCache.trigger('changed', this.files.get(path))
  }
}
