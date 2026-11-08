import type { App, TFile } from 'obsidian'
import { frontmatterOf, resolveLink, type ConfigStore } from '../obsidian/vault'
import type { RendererId } from '../shared/renderers/ids'

export interface LinkRenderers {
  /** The linked note's renderer; null when the link does not resolve or the note is a `document`. */
  of(target: string, fromPath: string): RendererId | null
  /** Whether `file`'s renderer differs from the one last seen by `of`. */
  changed(file: TFile): boolean
}

export function createLinkRenderers(app: App, config: ConfigStore): LinkRenderers {
  const seen = new Map<string, RendererId>()
  const rendererOf = (file: TFile): RendererId => config.rendererOf(frontmatterOf(app, file)).renderer
  return {
    of(target, fromPath) {
      const file = resolveLink(app, { target, embed: false }, fromPath)
      if (!file) return null
      const renderer = rendererOf(file)
      seen.set(file.path, renderer)
      return renderer === 'document' ? null : renderer
    },
    changed(file) {
      const before = seen.get(file.path)
      if (before === undefined) return false
      const now = rendererOf(file)
      seen.set(file.path, now)
      return now !== before
    }
  }
}
