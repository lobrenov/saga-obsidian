import type { MarkdownPostProcessorContext, Plugin } from 'obsidian'
import { afterEach, expect, test } from 'vitest'
import { registerPrint } from '../../src/print'
import type { MarkdownRenderChild } from '../fakes/obsidian'
import type { ConfigStore } from '../../src/obsidian/vault'
import type { PrefsStore } from '../../src/obsidian/prefs'
import { HeaderFakeApp } from '../fakes/header'
import { DEFAULT_CONFIG, FILES } from './header.support'

afterEach(() => document.body.replaceChildren())

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
const BROKEN = 'data:image/png;base64,AAAA'

type Processor = (el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void> | void

/** Registers the print processor over a fake vault; images resolve to `src`. */
function setup(src: string, documentCard = true) {
  const app = new HeaderFakeApp()
  for (const [p, t] of Object.entries(FILES)) app.addFile(p, t)
  app.addFile('Characters/Ada.md', '---\ntype: character\nbanner: "[[coast.jpg]]"\nportrait: "[[portrait.png]]"\n---\n')
  app.vault.getResourcePath = () => src
  let processor: Processor | undefined
  const children: MarkdownRenderChild[] = []
  const plugin = { app: app.asApp(), registerMarkdownPostProcessor: (fn: Processor) => void (processor = fn) } as unknown as Plugin
  registerPrint(plugin, { state: () => ({ config: DEFAULT_CONFIG }) } as unknown as ConfigStore, { get: () => ({ documentCard }) } as unknown as PrefsStore)
  const ctx = { sourcePath: 'Characters/Ada.md', addChild: (child: MarkdownRenderChild) => void children.push(child) } as unknown as MarkdownPostProcessorContext
  const run = (el: HTMLElement) => processor?.(el, ctx)
  return { run, children }
}

/** A print root (`.print > .markdown-preview-view`) with `count` section divs. */
function printRoot(count = 1): { root: HTMLElement; sections: HTMLElement[] } {
  const print = document.body.appendChild(document.createElement('div'))
  print.className = 'print'
  const root = print.appendChild(document.createElement('div'))
  root.className = 'markdown-preview-view markdown-rendered'
  const sections = Array.from({ length: count }, () => root.appendChild(document.createElement('div')))
  return { root, sections }
}

test('does nothing outside the print root', () => {
  const { run } = setup(PIXEL)
  const view = document.body.appendChild(document.createElement('div'))
  view.className = 'markdown-preview-view'
  const section = view.appendChild(document.createElement('div'))
  expect(run(section)).toBeUndefined()
  expect(document.querySelector('.saga-print')).toBeNull()
})

test('prepends exactly one print block per root, however many sections are processed', async () => {
  const { run } = setup(PIXEL)
  const { root, sections } = printRoot(3)
  await Promise.all(sections.map((section) => Promise.resolve(run(section))))
  expect(root.querySelectorAll('.saga-print')).toHaveLength(1)
  expect(root.firstElementChild?.querySelector('.saga-print .saga-header[data-renderer="character"]')).not.toBeNull()
  const second = printRoot()
  await run(second.sections[0] as HTMLElement)
  expect(second.root.querySelectorAll('.saga-print')).toHaveLength(1)
})

test('resolves only after the images have loaded', async () => {
  const { run } = setup(PIXEL)
  const { root, sections } = printRoot()
  await run(sections[0] as HTMLElement)
  const images = [...root.querySelectorAll('img')]
  expect(images).toHaveLength(2)
  for (const img of images) expect(img.complete && img.naturalWidth).toBe(1)
})

test('resolves when images fail, and hides the banner whose image failed', async () => {
  const { run } = setup(BROKEN)
  const { root, sections } = printRoot()
  await run(sections[0] as HTMLElement)
  expect(root.querySelector<HTMLElement>('.saga-banner')?.hidden).toBe(true)
  expect(root.querySelector('.saga-header')).not.toBeNull()
})

test('unloading the render child unmounts the block', async () => {
  const { run, children } = setup(PIXEL)
  const { root, sections } = printRoot()
  await run(sections[0] as HTMLElement)
  expect(children).toHaveLength(1)
  children[0]?.unload()
  expect(root.querySelector('.saga-header')).toBeNull()
})
