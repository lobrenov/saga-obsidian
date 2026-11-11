import type { App, TFile } from 'obsidian'
import type { Result } from '../shared/result'
import { resolveLink } from '../obsidian/vault'
import { mapLinkFrom } from './pins'
import { updatePins, type PinOpBuilder } from '../obsidian/vault'
import type { ShowMenu } from '../ui/menu'

/** What the map stage asks of its surroundings; the Obsidian UI parts (modals, notices, hover) are `HostUi`. */
export interface MapHost {
  /** The `[[…]]` link to the map as written in the note `from`. */
  mapLink(from: TFile): string
  /** Whether `link`, written in the note `from`, points at the map. */
  isMap(link: string, from: TFile): boolean
  /** Changes the note's `map-pins`, building the op from the list as it is in the file now. */
  updatePin(file: TFile, build: PinOpBuilder): Promise<Result<void>>
  openNote(file: TFile, newTab: boolean): void
  /** The note's text. */
  excerpt(file: TFile): Promise<string>
  /** Asks which note a new pin belongs to; null when cancelled. */
  pickNote(): Promise<TFile | null>
  /** Asks before a pin is removed. */
  confirmRemove(pin: { title: string; file: TFile }): Promise<boolean>
  notify(message: string): void
  hoverNote(event: MouseEvent, target: HTMLElement, file: TFile): void
  showMenu: ShowMenu
}

export type HostUi = Pick<MapHost, 'pickNote' | 'confirmRemove' | 'notify' | 'hoverNote' | 'showMenu'>

/** The host of one map over the vault; `ui` supplies the parts that open Obsidian UI. */
export function createHost(app: App, map: TFile, ui: HostUi): MapHost {
  return {
    ...ui,
    mapLink: (from) => mapLinkFrom(app, map, from),
    isMap: (link, from) => resolveLink(app, link, from.path)?.path === map.path,
    updatePin: (file, build) => updatePins(app, file, build),
    openNote: (file, newTab) => void app.workspace.openLinkText(file.path, map.path, newTab ? 'tab' : false),
    excerpt: (file) => app.vault.cachedRead(file)
  }
}
