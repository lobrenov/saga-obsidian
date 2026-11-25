import type { TFile } from 'obsidian'
import type { HeaderEnv } from '../../src/header/env'
import type { MenuAt, MenuItem } from '../../src/ui/menu'
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
  /** The paths of the notes it offers. */
  offered: () => string[]
  /** What choosing a suggestion does in Obsidian: the input takes the value and the picker reports it. */
  pick(target: string): void
}

/** A `HeaderEnv` over the fake app: links go through `workspace.openLinkText`; hovers, suggesters and menus are recorded. */
export function testEnv(app: HeaderFakeApp): {
  env: HeaderEnv
  suggesters: Suggester[]
  hovered: string[]
  menus: { at: MenuAt; items: MenuItem[]; parent?: HTMLElement | undefined }[]
  confirms: { title: string; message: string; action: string; cancel: string }[]
  notices: string[]
  /** What the next confirmations answer. */
  answer: { confirm: boolean }
  /** Chooses an item of the newest menu by title, as a click would. */
  choose: (title: string) => void
} {
  const suggesters: Suggester[] = []
  const hovered: string[] = []
  const menus: { at: MenuAt; items: MenuItem[]; parent?: HTMLElement | undefined }[] = []
  const confirms: { title: string; message: string; action: string; cancel: string }[] = []
  const notices: string[] = []
  const answer = { confirm: true }
  const env: HeaderEnv = {
    app: app.asApp(),
    openLink: (target, from, event) => void app.workspace.openLinkText(target, from, event.metaKey || event.ctrlKey),
    hover: (_event, _el, target) => void hovered.push(target),
    setIcon: (el, name) => {
      el.dataset.icon = name
    },
    showMenu: (at, items, parent) => {
      parent?.classList.add('has-active-menu')
      menus.push({ at, items, parent })
    },
    confirm: (title, message, action, cancel) => {
      confirms.push({ title, message, action, cancel })
      return Promise.resolve(answer.confirm)
    },
    notify: (message) => void notices.push(message),
    suggest(input, kind, from, onPick, only) {
      const suggester: Suggester = {
        input,
        kind,
        from,
        offered: () =>
          app
            .asApp()
            .vault.getMarkdownFiles()
            .filter((file) => only?.(file) ?? true)
            .map((file) => file.path),
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
  const choose = (title: string): void => {
    const menu = menus.at(-1)
    const item = menu?.items.find((candidate) => candidate.title === title)
    if (!item) throw new Error(`no menu item ${title}`)
    item.onClick()
    menu?.parent?.classList.remove('has-active-menu')
  }
  return { env, suggesters, hovered, menus, confirms, notices, answer, choose }
}
