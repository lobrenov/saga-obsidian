import { MarkdownRenderChild, setIcon, type MarkdownPostProcessorContext, type Plugin } from 'obsidian'
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { PrefsStore } from '../obsidian/prefs'
import { frontmatterOf, type ConfigStore } from '../obsidian/vault'
import { printRootOf } from './dom'
import { PrintNote } from './PrintNote'
import './print.css'

/** Resolves once the image has loaded or failed; a failed banner image hides its banner. */
const settled = (img: HTMLImageElement): Promise<void> =>
  new Promise((resolve) => {
    const done = (): void => {
      if (img.naturalWidth === 0) img.closest<HTMLElement>('.saga-banner')?.setAttribute('hidden', '')
      resolve()
    }
    if (img.complete) done()
    else for (const type of ['load', 'error']) img.addEventListener(type, done, { once: true })
  })

/** Adds the note's banner and header card as the first child of core's PDF export, and holds the export until their images are in. */
export function registerPrint(plugin: Plugin, config: ConfigStore, prefs: PrefsStore): void {
  const { app } = plugin
  const printed = new WeakMap<HTMLElement, Promise<void>>()

  const print = async (root: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> => {
    await Promise.resolve()
    const file = app.vault.getFileByPath(ctx.sourcePath)
    if (!file) return
    const host = root.ownerDocument.createElement('div')
    root.prepend(host)
    const reactRoot = createRoot(host)
    const child = new MarkdownRenderChild(host)
    child.onunload = () => reactRoot.unmount()
    ctx.addChild(child)
    const note = createElement(PrintNote, {
      app,
      setIcon,
      file,
      frontmatter: frontmatterOf(app, file),
      config: config.state().config,
      documentCard: prefs.get().documentCard
    })
    flushSync(() => reactRoot.render(note))
    await Promise.all([...host.querySelectorAll('img')].map(settled))
  }

  plugin.registerMarkdownPostProcessor((el, ctx) => {
    const root = printRootOf(el)
    if (!root) return
    const done = printed.get(root) ?? print(root, ctx)
    printed.set(root, done)
    return done
  })
}
