import type { Plugin } from 'obsidian'

export type PinLabels = 'always' | 'hover'

/** Obsidian-only preferences, stored in the plugin's `data.json` (not in `.saga/renderers.yaml`). */
export interface Prefs {
  pinLabels: PinLabels
  /** Wikilinks in note text show the linked note's renderer icon. */
  linkIcons: boolean
}

export interface PrefsStore {
  get(): Prefs
  set(patch: Partial<Prefs>): Promise<void>
  /** Calls `callback` after each change; returns the unsubscribe. */
  subscribe(callback: (prefs: Prefs) => void): () => void
}

export async function createPrefsStore(plugin: Plugin): Promise<PrefsStore> {
  const saved = (await plugin.loadData()) as Partial<Prefs> | null
  let prefs: Prefs = { pinLabels: saved?.pinLabels === 'hover' ? 'hover' : 'always', linkIcons: saved?.linkIcons === true }
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
