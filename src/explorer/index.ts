import type { Plugin } from 'obsidian'
import { linkIcon } from '../links/editor'
import { createLinkRenderers, lookIcon } from '../links/renderers'
import type { Prefs, PrefsStore } from '../obsidian/prefs'
import type { ConfigStore } from '../obsidian/vault'
import { EXPLORER_VIEW, isFolder, pathOf, removeIcons, setTitleIcon, titlesIn } from './dom'
import './explorer.css'

/** The closed and open folder icons; CSS shows the one matching the folder's state. */
function folderIcon(doc: Document): HTMLElement {
  const el = doc.createElement('span')
  for (const icon of ['folder', 'folder-open']) el.appendChild(linkIcon(doc, { renderer: 'document', icon, color: null })).classList.add(`saga-${icon}`)
  return el
}

/** While the `fileIcons` pref is on, the file explorer shows a folder icon in place of each folder's arrow and the note's icon (`linkIconLook`) before each Markdown note; untyped notes show the `document` icon while `fileIconsUntyped` is on. */
export function registerFileIcons(plugin: Plugin, config: ConfigStore, prefs: PrefsStore): void {
  const { app } = plugin
  const renderers = createLinkRenderers(app, config)
  const explorers = new Set<HTMLElement>()

  const iconOf = (title: HTMLElement, current: Prefs): HTMLElement | null => {
    const doc = title.ownerDocument
    if (isFolder(title)) return folderIcon(doc)
    const file = app.vault.getFileByPath(pathOf(title))
    if (file?.extension !== 'md') return null
    const target = renderers.ofFile(file)
    if (target.renderer === 'document' && !current.fileIconsUntyped) return null
    return linkIcon(doc, lookIcon(target, current.linkIconLook))
  }
  const draw = (title: HTMLElement): void => {
    const current = prefs.get()
    setTitleIcon(title, current.fileIcons ? iconOf(title, current) : null)
  }
  const redraw = (path?: string): void => {
    for (const el of explorers) for (const title of titlesIn(el)) if (path === undefined || pathOf(title) === path) draw(title)
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) for (const node of Array.from(record.addedNodes)) if (node.nodeType === Node.ELEMENT_NODE) titlesIn(node as Element).forEach(draw)
  })
  const watch = (): void => {
    for (const leaf of app.workspace.getLeavesOfType(EXPLORER_VIEW)) {
      const el = leaf.view.containerEl
      if (explorers.has(el)) continue
      explorers.add(el)
      observer.observe(el, { childList: true, subtree: true })
      titlesIn(el).forEach(draw)
    }
  }
  plugin.register(() => {
    observer.disconnect()
    explorers.forEach(removeIcons)
  })

  let shown = prefs.get()
  plugin.register(
    prefs.subscribe((next) => {
      if (next.fileIcons === shown.fileIcons && next.fileIconsUntyped === shown.fileIconsUntyped && next.linkIconLook === shown.linkIconLook) return
      shown = next
      redraw()
    })
  )
  plugin.register(config.subscribe(() => redraw()))
  plugin.registerEvent(app.metadataCache.on('changed', (file) => redraw(file.path)))
  app.workspace.onLayoutReady(() => {
    watch()
    plugin.registerEvent(app.workspace.on('layout-change', watch))
    plugin.registerEvent(app.vault.on('rename', () => redraw()))
  })
}
