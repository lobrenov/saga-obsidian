import type { EditorView } from '@codemirror/view'
import { MarkdownView, type Plugin } from 'obsidian'
import type { PrefsStore } from '../obsidian/prefs'
import type { ConfigStore } from '../obsidian/vault'
import { parseWikiInner } from '../shared/markdown/wikiSyntax'
import { linkIcon, linkIconsExtension, refreshLinkIcons, type RendererOf } from './editor'
import './links.css'
import { createLinkRenderers } from './renderers'

/** While the `linkIcons` pref is on, wikilinks in Live Preview and Reading view show the linked note's renderer icon. */
export function registerLinkIcons(plugin: Plugin, config: ConfigStore, prefs: PrefsStore): void {
  const { app } = plugin
  const renderers = createLinkRenderers(app, config)
  const rendererOf: RendererOf = (target, fromPath) => (prefs.get().linkIcons ? renderers.of(target, fromPath) : null)
  const editors = new Set<EditorView>()
  const refresh = (): void => {
    for (const view of editors) view.dispatch({ effects: refreshLinkIcons.of(null) })
    app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView && leaf.view.getMode() === 'preview') leaf.view.previewMode.rerender(true)
    })
  }

  plugin.registerEditorExtension(linkIconsExtension(rendererOf, editors))
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    for (const a of Array.from(el.querySelectorAll('a.internal-link'))) {
      const href = a.getAttribute('data-href')
      const renderer = href ? rendererOf(parseWikiInner(href).target, ctx.sourcePath) : null
      if (renderer) a.prepend(linkIcon(a.ownerDocument, renderer))
    }
  })

  let enabled = prefs.get().linkIcons
  plugin.register(
    prefs.subscribe((next) => {
      if (next.linkIcons === enabled) return
      enabled = next.linkIcons
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
