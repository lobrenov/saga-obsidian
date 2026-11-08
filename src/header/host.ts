import { AbstractInputSuggest, Keymap, prepareFuzzySearch, setIcon, type App, type HoverParent, type TFile } from 'obsidian'
import type { HeaderEnv } from './env'

export const HOVER_SOURCE = 'saga-header'

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp'])

/** Suggests vault files ranked by fuzzy match on their path; picking one reports its shortest link text. */
class FileSuggest extends AbstractInputSuggest<TFile> {
  constructor(
    app: App,
    input: HTMLInputElement,
    private readonly files: () => TFile[],
    private readonly from: () => string,
    private readonly onPick: (target: string) => void
  ) {
    super(app, input)
  }

  protected override getSuggestions(query: string): TFile[] {
    const match = prepareFuzzySearch(query)
    return this.files()
      .map((file) => ({ file, result: match(file.path) }))
      .filter((entry) => entry.result !== null)
      .sort((a, b) => (b.result?.score ?? 0) - (a.result?.score ?? 0))
      .map((entry) => entry.file)
  }

  override renderSuggestion(file: TFile, el: HTMLElement): void {
    el.createDiv({ text: file.basename })
    el.createDiv({ text: file.path, cls: 'saga-header-suggest-path' })
  }

  override selectSuggestion(file: TFile): void {
    const target = this.app.metadataCache.fileToLinktext(file, this.from(), file.extension === 'md')
    this.setValue(target)
    this.close()
    this.onPick(target)
  }
}

/** The Obsidian side of the header: link opening with hover previews, icons and file suggesters. */
export function createHeaderEnv(app: App): HeaderEnv {
  const hoverParent: HoverParent = { hoverPopover: null }
  return {
    app,
    openLink: (target, from, event) => void app.workspace.openLinkText(target, from, Keymap.isModEvent(event as MouseEvent)),
    hover: (event, targetEl, linktext, sourcePath) =>
      app.workspace.trigger('hover-link', { event, source: HOVER_SOURCE, hoverParent, targetEl, linktext, sourcePath }),
    setIcon,
    suggest(input, kind, from, onPick) {
      const files = kind === 'note' ? () => app.vault.getMarkdownFiles() : () => app.vault.getFiles().filter((file) => IMAGE_EXTENSIONS.has(file.extension.toLowerCase()))
      const suggest = new FileSuggest(app, input, files, from, onPick)
      return () => suggest.close()
    }
  }
}
