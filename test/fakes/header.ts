import type { TFile } from 'obsidian'
import type { HeaderEnv } from '../../src/header/env'
import { FakeApp } from './obsidian'

/** The fake `App` with `fileManager.renameFile` recording its calls. */
export class HeaderFakeApp extends FakeApp {
  readonly renamed: { from: string; to: string }[] = []

  override readonly fileManager = {
    renameFile: (file: TFile, to: string): Promise<void> => {
      this.renamed.push({ from: file.path, to })
      return Promise.resolve()
    }
  }
}

export interface Suggester {
  input: HTMLInputElement
  kind: 'note' | 'image'
  from: () => string
  /** What choosing a suggestion does in Obsidian: the input takes the value and the picker reports it. */
  pick(target: string): void
}

/** A `HeaderEnv` over the fake app: links go through `workspace.openLinkText`, hovers and suggesters are recorded. */
export function testEnv(app: HeaderFakeApp): { env: HeaderEnv; suggesters: Suggester[]; hovered: string[] } {
  const suggesters: Suggester[] = []
  const hovered: string[] = []
  const env: HeaderEnv = {
    app: app.asApp(),
    openLink: (target, from, event) => void app.workspace.openLinkText(target, from, event.metaKey || event.ctrlKey),
    hover: (_event, _el, target) => void hovered.push(target),
    setIcon: (el, name) => {
      el.dataset.icon = name
    },
    suggest(input, kind, from, onPick) {
      const suggester: Suggester = {
        input,
        kind,
        from,
        pick(target) {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, target)
          input.dispatchEvent(new Event('input', { bubbles: true }))
          onPick(target)
        }
      }
      suggesters.push(suggester)
      return () => void suggesters.splice(suggesters.indexOf(suggester), 1)
    }
  }
  return { env, suggesters, hovered }
}
