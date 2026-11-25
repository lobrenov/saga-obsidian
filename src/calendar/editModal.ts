import { Modal, type App } from 'obsidian'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createHeaderEnv } from '../header/host'
import { EditEntry, type EditEntryProps } from './EditEntry'

/** The Edit dialog of a calendar entry; Esc or the close button discards the draft. */
export class EditEntryModal extends Modal {
  private root: Root | null = null

  constructor(
    app: App,
    private readonly props: Omit<EditEntryProps, 'env' | 'onDone'>
  ) {
    super(app)
  }

  override onOpen(): void {
    this.setTitle(`Edit ${this.props.noun}`)
    this.modalEl.addClass('saga-entry-edit-modal')
    this.root = createRoot(this.contentEl)
    this.root.render(createElement(EditEntry, { ...this.props, env: createHeaderEnv(this.app), onDone: () => this.close() }))
  }

  /** Escape, the close button and a click outside close an open date picker first, keeping the draft. */
  override close(): void {
    const picker = this.contentEl.querySelector('.saga-lore-popover')
    if (picker) {
      picker.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      return
    }
    super.close()
  }

  override onClose(): void {
    this.root?.unmount()
    this.root = null
    this.contentEl.empty()
  }
}
