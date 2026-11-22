import type { App, TFile } from 'obsidian'
import { frontmatterOf, resolveLink, type ConfigStore } from '../obsidian/vault'
import { resolveLook } from '../shared/pins/look'
import { parseMapPins } from '../shared/schemas/pins'
import type { PlacedPin } from './types'

/** The pins on `map` from the `map-pins` of `files`: entries whose `map` link resolves (from the note holding it) to the map note. */
export function collectPins(app: App, config: ConfigStore, files: readonly TFile[], map: TFile): PlacedPin[] {
  const pins: PlacedPin[] = []
  for (const file of files) {
    if (file.extension !== 'md' || file.path === map.path) continue
    const frontmatter = frontmatterOf(app, file)
    const { renderer } = config.rendererOf(frontmatter)
    const defaults = config.pinLookOf(renderer)
    for (const entry of parseMapPins(frontmatter['map-pins']).entries) {
      if (!entry.pin || resolveLink(app, entry.pin.map, file.path)?.path !== map.path) continue
      pins.push({ file, title: file.basename, renderer, x: entry.pin.x, y: entry.pin.y, look: resolveLook(entry.pin, defaults), defaults, index: entry.index, issues: entry.issues.map((issue) => issue.message) })
    }
  }
  return pins
}

/** The `[[…]]` link to `map` as written in the note at `from`. */
export const mapLinkFrom = (app: App, map: TFile, from: TFile): string => `[[${app.metadataCache.fileToLinktext(map, from.path, true)}]]`
