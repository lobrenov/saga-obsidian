import { FuzzySuggestModal, Modal, type App, type FuzzyMatch, type TFile } from 'obsidian'
import { IconPicker } from '../ui/iconPicker'

/** A note to pin, or a new note to create (named after the typed text, if any). */
export type NoteChoice = { kind: 'file'; file: TFile } | { kind: 'create'; name: string | undefined }

class NotePickerModal extends FuzzySuggestModal<NoteChoice> {
  constructor(
    app: App,
    private readonly files: readonly TFile[],
    private readonly done: (choice: NoteChoice | null) => void
  ) {
    super(app)
    this.setPlaceholder('Pin which note?')
  }

  getItems(): NoteChoice[] {
    return this.files.map((file) => ({ kind: 'file', file }))
  }

  getItemText(item: NoteChoice): string {
    return item.kind === 'file' ? item.file.path.replace(/\.md$/, '') : 'Create note'
  }

  override getSuggestions(query: string): FuzzyMatch<NoteChoice>[] {
    const name = query.trim()
    return [...super.getSuggestions(query), { item: { kind: 'create', name: name || undefined }, match: { score: -1000, matches: [] } }]
  }

  override renderSuggestion(item: FuzzyMatch<NoteChoice>, el: HTMLElement): void {
    if (item.item.kind === 'create') el.setText(item.item.name ? `Create note "${item.item.name}"` : 'Create note…')
    else super.renderSuggestion(item, el)
  }

  onChooseItem(item: NoteChoice): void {
    this.done(item)
  }

  override onClose(): void {
    super.onClose()
    // The choice is made after the modal closes; a close without one resolves with none.
    window.setTimeout(() => this.done(null), 0)
  }
}

/** Asks which note a pin belongs to; null when dismissed. */
export const chooseNote = (app: App, files: readonly TFile[]): Promise<NoteChoice | null> => new Promise((resolve) => new NotePickerModal(app, files, resolve).open())

class IconChoiceModal extends IconPicker {
  constructor(
    app: App,
    private readonly done: (id: string | null) => void
  ) {
    super(app, done)
  }

  override onClose(): void {
    super.onClose()
    // The choice is made after the modal closes; a close without one resolves with none.
    window.setTimeout(() => this.done(null), 0)
  }
}

/** Asks which icon a pin shows; null when dismissed. */
export const chooseIcon = (app: App): Promise<string | null> => new Promise((resolve) => new IconChoiceModal(app, resolve).open())

class ConfirmModal extends Modal {
  constructor(
    app: App,
    private readonly title: string,
    private readonly message: string,
    private readonly action: string,
    private readonly cancel: string,
    private readonly done: (confirmed: boolean) => void
  ) {
    super(app)
  }

  override onOpen(): void {
    this.titleEl.setText(this.title)
    this.contentEl.createEl('p', { text: this.message })
    const buttons = this.contentEl.createDiv({ cls: 'modal-button-container' })
    buttons.createEl('button', { text: this.action, cls: 'mod-warning' }).addEventListener('click', () => {
      this.done(true)
      this.close()
    })
    buttons.createEl('button', { text: this.cancel }).addEventListener('click', () => this.close())
  }

  override onClose(): void {
    this.contentEl.empty()
    this.done(false)
  }
}

/** Asks before an action; false when dismissed. */
export const confirm = (app: App, title: string, message: string, action: string, cancel = 'Keep'): Promise<boolean> =>
  new Promise((resolve) => new ConfirmModal(app, title, message, action, cancel, resolve).open())
