import type { Plugin } from 'obsidian'

export type PinLabels = 'always' | 'hover'
/** `renderer`, or a map note's path. */
export type LinkIconLook = 'renderer' | (string & {})

/** Obsidian-only preferences, stored in the plugin's `data.json` (not in `.saga/renderers.yaml`). */
export interface Prefs {
  pinLabels: PinLabels
  /** Wikilinks in note text show the linked note's renderer icon. */
  linkIcons: boolean
  /** Link icons show the renderer's icon and colour, or the note's pin look on the map at this path (the renderer's when it has no pin there). */
  linkIconLook: LinkIconLook
  /** Wikilinks to characters show the character's title after the link. */
  linkTitles: boolean
  /** The file explorer shows an icon before each folder and typed note, in the `linkIconLook`. */
  fileIcons: boolean
  /** With `fileIcons`, notes with no renderer type show the `document` icon. */
  fileIconsUntyped: boolean
  /** Notes with no renderer type always show the Document card; off, only while they have a banner. */
  documentCard: boolean
}

export interface PrefsStore {
  get(): Prefs
  set(patch: Partial<Prefs>): Promise<void>
  /** Calls `callback` after each change; returns the unsubscribe. */
  subscribe(callback: (prefs: Prefs) => void): () => void
}

export async function createPrefsStore(plugin: Plugin): Promise<PrefsStore> {
  const saved = (await plugin.loadData()) as Partial<Prefs> | null
  let prefs: Prefs = {
    pinLabels: saved?.pinLabels === 'hover' ? 'hover' : 'always',
    linkIcons: saved?.linkIcons === true,
    linkIconLook: typeof saved?.linkIconLook === 'string' && saved.linkIconLook.endsWith('.md') ? saved.linkIconLook : 'renderer',
    linkTitles: saved?.linkTitles === true,
    fileIcons: saved?.fileIcons === true,
    fileIconsUntyped: saved?.fileIconsUntyped !== false,
    documentCard: saved?.documentCard !== false
  }
  const listeners = new Set<(prefs: Prefs) => void>()
  const set = async (patch: Partial<Prefs>): Promise<void> => {
    prefs = { ...prefs, ...patch }
    await plugin.saveData(prefs)
    listeners.forEach((callback) => callback(prefs))
  }
  // The icon look's map follows a rename of the map or a folder holding it.
  plugin.registerEvent(
    plugin.app.vault.on('rename', (file, oldPath) => {
      const look = prefs.linkIconLook
      if (look === oldPath) void set({ linkIconLook: file.path })
      else if (look.startsWith(`${oldPath}/`)) void set({ linkIconLook: file.path + look.slice(oldPath.length) })
    })
  )
  return {
    get: () => prefs,
    set,
    subscribe(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    }
  }
}
