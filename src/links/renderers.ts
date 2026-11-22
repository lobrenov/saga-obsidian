import type { App, TFile } from 'obsidian'
import type { LinkIconLook, Prefs } from '../obsidian/prefs'
import { frontmatterOf, resolveLink, type ConfigStore } from '../obsidian/vault'
import { resolveLook, type ColorId, type PinLook } from '../shared/pins/look'
import { rendererDefs } from '../shared/renderers/definitions'
import type { RendererId } from '../shared/renderers/ids'
import { parseMapPins } from '../shared/schemas/pins'

/** What a link shows of the note it resolves to. */
export interface LinkTarget {
  renderer: RendererId
  /** The note's pin look on each map it has a pin on, by map path: its first pin there, its own keys over the renderer's. */
  pins: Record<string, PinLook>
  /** A character's title field, trimmed; null for other notes or a blank title. */
  title: string | null
}

/** The icon drawn before a link; a null colour is the renderer's `--saga-<renderer>` token. */
export interface LinkIcon {
  renderer: RendererId
  icon: string
  color: ColorId | null
}

export interface LinkMarks {
  icon: LinkIcon | null
  title: string | null
}

export const NO_MARKS: LinkMarks = { icon: null, title: null }

/** The icon and colour of the note's pin on the `iconLook` map, else the renderer's icon. */
export function lookIcon({ renderer, pins }: LinkTarget, iconLook: LinkIconLook): LinkIcon {
  const look = iconLook === 'renderer' ? undefined : pins[iconLook]
  return look ? { renderer, icon: look.icon, color: look.color } : { renderer, icon: rendererDefs[renderer].icon, color: null }
}

/** The icon and title a link shows under `prefs`. */
export function linkMarks(target: LinkTarget | null, prefs: Prefs): LinkMarks {
  if (!target) return NO_MARKS
  return { icon: prefs.linkIcons ? lookIcon(target, prefs.linkIconLook) : null, title: prefs.linkTitles ? target.title : null }
}

export interface LinkRenderers {
  /** The linked note's target; null when the link does not resolve or the note is a `document`. */
  of(target: string, fromPath: string): LinkTarget | null
  /** A note's target, `document` notes included. */
  ofFile(file: TFile): LinkTarget
  /** Whether `file`'s target differs from the one last seen by `of`. */
  changed(file: TFile): boolean
}

export function createLinkRenderers(app: App, config: ConfigStore): LinkRenderers {
  const seen = new Map<string, string>()
  const targetOf = (file: TFile): LinkTarget => {
    const frontmatter = frontmatterOf(app, file)
    const { renderer } = config.rendererOf(frontmatter)
    const defaults = config.pinLookOf(renderer)
    const pins: Record<string, PinLook> = {}
    for (const { pin } of parseMapPins(frontmatter['map-pins']).entries) {
      const map = pin && resolveLink(app, pin.map, file.path)
      if (map && !(map.path in pins)) pins[map.path] = resolveLook(pin, defaults)
    }
    const raw = renderer === 'character' ? frontmatter[config.state().config.renderers.character?.keys.title ?? 'title'] : undefined
    const title = typeof raw === 'string' && raw.trim() ? raw.trim() : null
    return { renderer, pins, title }
  }
  return {
    of(target, fromPath) {
      const file = resolveLink(app, { target, embed: false }, fromPath)
      if (!file) return null
      const linked = targetOf(file)
      seen.set(file.path, JSON.stringify(linked))
      return linked.renderer === 'document' ? null : linked
    },
    ofFile: targetOf,
    changed(file) {
      const before = seen.get(file.path)
      if (before === undefined) return false
      const now = JSON.stringify(targetOf(file))
      seen.set(file.path, now)
      return now !== before
    }
  }
}
