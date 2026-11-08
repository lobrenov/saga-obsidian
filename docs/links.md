# Link icons (as built)

With Settings → Saga → Link icons on (`linkIcons` in `data.json`, default off), wikilinks in note text show the linked note's renderer icon before the link text, coloured by its `--saga-<renderer>` token. Links to `document` notes, unresolved links and embeds get none. Source mode shows none.

## Modules
- `index.ts`: `registerLinkIcons(plugin, config, prefs)`. Registers the editor extension and a Markdown post-processor, and refreshes on a `linkIcons` change, a config change, a seen note's renderer change (`metadataCache` `changed`), and vault `create`, `delete` and `rename` (after layout ready).
- `renderers.ts`: `createLinkRenderers(app, config)`: `of(target, fromPath)` (`resolveLink`, then `config.rendererOf`), and `changed(file)`, true when a note's renderer differs from the one `of` last saw.
- `syntax.ts`: `wikilinksIn(state, from, to)` walks Obsidian's syntax tree, whose node names are `_`-joined token classes: from a `formatting-link-start` node over `[[` (not `formatting-embed`) to the next `formatting-link-end`; the target is `parseWikiInner` of the text between. Links in code have no such nodes.
- `editor.ts`: `linkIcon(doc, renderer)` (`span.saga-link-icon[data-renderer]` with `setIcon`); `linkIconsExtension`, a `ViewPlugin` adding a widget (`side: -1`) at each link's `[[` in the visible ranges while `editorLivePreviewField` is on, rebuilt on doc, viewport, syntax tree, mode changes and the `refreshLinkIcons` effect.
- `links.css`.

## Reading view
The post-processor prepends the icon to each `a.internal-link`, resolving `data-href` from `ctx.sourcePath`. It also covers the blocks Live Preview renders (tables, callouts) and embeds. A refresh dispatches `refreshLinkIcons` to every open editor and calls `previewMode.rerender(true)` on leaves in Reading view.
