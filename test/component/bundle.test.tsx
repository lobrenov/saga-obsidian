import * as language from '@codemirror/language'
import * as state from '@codemirror/state'
import * as view from '@codemirror/view'
import { expect, it } from 'vitest'
import code from '../../main.js?raw'

/** Evaluates the built bundle as Obsidian does (CommonJS, `obsidian` and `@codemirror/*` from `require`) and runs `onload` against a stub app. */
it('loads the built plugin and registers its views', async () => {
  const calls: string[] = []
  const events = { on: () => ({}), off: () => undefined, trigger: () => undefined }
  const app = {
    vault: { ...events, adapter: { exists: () => Promise.resolve(false), read: () => Promise.resolve('') } },
    workspace: { ...events, onLayoutReady: (callback: () => void) => callback(), iterateAllLeaves: () => undefined, getLeavesOfType: () => [] },
    metadataCache: { ...events }
  }
  class Plugin {
    app = app
    loadData(): Promise<null> {
      return Promise.resolve(null)
    }
    saveData(): Promise<void> {
      return Promise.resolve()
    }
    registerEvent(): void {}
    register(): void {}
    registerBasesView(id: string): boolean {
      calls.push(`view ${id}`)
      return true
    }
    registerHoverLinkSource(id: string): void {
      calls.push(`hover ${id}`)
    }
    addSettingTab(): void {
      calls.push('settings')
    }
    registerEditorExtension(): void {
      calls.push('editor extension')
    }
    registerMarkdownPostProcessor(): void {
      calls.push('post processor')
    }
  }
  const obsidian = new Proxy<Record<string, unknown>>({ Plugin }, { get: (target, key: string) => target[key] ?? class {} })
  const module = { exports: {} as { default?: new () => { onload(): Promise<void> } } }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- evaluates the bundle as Obsidian's loader does
  const run = new Function('module', 'exports', 'require', code) as (m: typeof module, e: object, r: (name: string) => unknown) => void
  run(module, module.exports, (name) => {
    if (name === 'obsidian') return obsidian
    if (name === '@codemirror/language') return language
    if (name === '@codemirror/state') return state
    if (name === '@codemirror/view') return view
    throw new Error(`Unexpected require: ${name}`)
  })
  const SagaPlugin = module.exports.default
  if (!SagaPlugin) throw new Error('No default export')
  await new SagaPlugin().onload()
  expect(calls.sort()).toEqual(['editor extension', 'hover saga', 'hover saga-header', 'post processor', 'post processor', 'settings', 'view saga-map'])
})
