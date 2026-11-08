import { createContext, useContext } from 'react'
import type { App, TFile } from 'obsidian'
import type { Config } from '../shared/schemas/config'

/** What the header takes from Obsidian beyond the `App`; `host.ts` implements it, tests fake it. */
export interface HeaderEnv {
  app: App
  /** Opens a link; a modifier-click opens a new tab. */
  openLink(target: string, from: string, event: Pick<MouseEvent, 'metaKey' | 'ctrlKey'>): void
  /** Shows the hover preview of a link. */
  hover(event: MouseEvent, el: HTMLElement, target: string, from: string): void
  setIcon(el: HTMLElement, name: string): void
  /** Attaches a file suggester to `input` once; `from` gives the path of the note at pick time and `onPick` the link text of the chosen file. Returns the cleanup. */
  suggest(input: HTMLInputElement, kind: 'note' | 'image', from: () => string, onPick: (target: string) => void): () => void
}

export interface HeaderContext {
  env: HeaderEnv
  file: TFile
  config: Config
}

export const HeaderCtx = createContext<HeaderContext | null>(null)

export function useHeader(): HeaderContext {
  const context = useContext(HeaderCtx)
  if (!context) throw new Error('useHeader outside a header')
  return context
}
