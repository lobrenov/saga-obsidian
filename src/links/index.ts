import type { EditorView } from '@codemirror/view'
import { MarkdownView, type Plugin } from 'obsidian'
import type { PrefsStore } from '../obsidian/prefs'
import type { ConfigStore } from '../obsidian/vault'
import { parseWikiInner } from '../shared/markdown/wikiSyntax'
import { linkIcon, linkIconsExtension, linkTitle, refreshLinkIcons, type MarksOf } from './editor'
import './links.css'
import { createLinkRenderers, linkMarks, NO_MARKS } from './renderers'

/** While the `linkIcons` or `linkTitles` pref is on, wikilinks in Live Preview and Reading view show the linked note's icon or a character's title. */
export function registerLinkIcons(plugin: Plugin, config: ConfigStore, prefs: PrefsStore): void {
  const { app } = plugin
  const renderers = createLinkRenderers(app, config)
  const marksOf: MarksOf = (target, fromPath) => {
    const current = prefs.get()
    return current.linkIcons || current.linkTitles ? linkMarks(renderers.of(target, fromPath), current) : NO_MARKS
  }
  const editors = new Set<EditorView>()
  const refresh = (): void => {
    for (const view of editors) view.dispatch({ effects: refreshLinkIcons.of(null) })
    app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView && leaf.view.getMode() === 'preview') leaf.view.previewMode.rerender(true)
    })
  }

  plugin.registerEditorExtension(linkIconsExtension(marksOf, editors))
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    for (const a of Array.from(el.querySelectorAll('a.internal-link'))) {
      const href = a.getAttribute('data-href')
      const { icon, title } = href ? marksOf(parseWikiInner(href).target, ctx.sourcePath) : NO_MARKS
      if (icon) a.prepend(linkIcon(icon))
      if (title) a.after(linkTitle(title))
    }
  })

  let shown = prefs.get()
  plugin.register(
    prefs.subscribe((next) => {
      if (next.linkIcons === shown.linkIcons && next.linkIconLook === shown.linkIconLook && next.linkTitles === shown.linkTitles) return
      shown = next
      refresh()
    })
  )
  plugin.register(config.subscribe(refresh))
  plugin.registerEvent(
    app.metadataCache.on('changed', (file) => {
      if (renderers.changed(file)) refresh()
    })
  )
  app.workspace.onLayoutReady(() => {
    plugin.registerEvent(app.vault.on('create', refresh))
    plugin.registerEvent(app.vault.on('delete', refresh))
    plugin.registerEvent(app.vault.on('rename', refresh))
  })
}
