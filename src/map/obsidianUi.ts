import { Notice, type App, type BasesView, type HoverParent, type TFile } from 'obsidian'
import { showMenu } from '../ui/menu'
import type { HostUi } from './host'
import { chooseIcon, chooseNote, confirm } from './modals'

export const HOVER_SOURCE = 'saga'

/** A note created through the base (which applies its filters and folder), or null when none was made; resolves once the base is done with the note. */
async function createNote(view: BasesView, name: string | undefined): Promise<TFile | null> {
  const made: { file: TFile | null } = { file: null }
  await view.createFileForView(name, (_frontmatter, file) => {
    made.file = file
  })
  return made.file
}

/** The Obsidian UI of a map view: the note picker over the base's notes, the icon picker, the removal prompt, notices and hover previews. */
export function createUi(app: App, view: BasesView & HoverParent, mapPath: string, files: () => TFile[]): HostUi {
  return {
    async pickNote() {
      const choice = await chooseNote(app, files().filter((file) => file.path !== mapPath))
      if (!choice) return null
      if (choice.kind === 'file') return choice.file
      const created = await createNote(view, choice.name)
      if (!created) new Notice('The note was not created; no pin was added.')
      return created
    },
    pickIcon: () => chooseIcon(app),
    confirmRemove: (pin) => confirm(app, 'Remove pin', `Remove this pin from ${pin.file.name}?`, 'Remove pin'),
    notify: (message) => void new Notice(message),
    showMenu,
    hoverNote: (event, target, file) => app.workspace.trigger('hover-link', { event, source: HOVER_SOURCE, hoverParent: view, targetEl: target, linktext: file.path, sourcePath: mapPath })
  }
}
