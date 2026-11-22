import type { Plugin } from 'obsidian'

export type PinLabels = 'always' | 'hover'
export type LinkIconLook = 'renderer' | 'pin'

/** Obsidian-only preferences, stored in the plugin's `data.json` (not in `.saga/renderers.yaml`). */
export interface Prefs {
  pinLabels: PinLabels
  /** Wikilinks in note text show the linked note's renderer icon. */
  linkIcons: boolean
  /** Link icons show the renderer's icon and colour, or the linked note's pin look. */
  linkIconLook: LinkIconLook
  /** Wikilinks to characters show the character's title after the link. */
  linkTitles: boolean
  /** The file explorer shows an icon before each folder and typed note, in the `linkIconLook`. */
  fileIcons: boolean
  /** With `fileIcons`, notes with no renderer type show the `document` icon. */
  fileIconsUntyped: boolean
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
    linkIconLook: saved?.linkIconLook === 'pin' ? 'pin' : 'renderer',
    linkTitles: saved?.linkTitles === true,
    fileIcons: saved?.fileIcons === true,
    fileIconsUntyped: saved?.fileIconsUntyped !== false
  }
  const listeners = new Set<(prefs: Prefs) => void>()
  return {
    get: () => prefs,
    async set(patch) {
      prefs = { ...prefs, ...patch }
      await plugin.saveData(prefs)
      listeners.forEach((callback) => callback(prefs))
    },
    subscribe(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    }
  }
}
