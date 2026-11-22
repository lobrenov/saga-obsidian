# Link icons and titles (as built)

Settings → Saga → Markdown rendering, in `data.json` (all default off or `renderer`):
- `linkIcons` (Render icons with wikilinks?): wikilinks in note text show an icon before the link text. `linkIconLook` (Icon look) picks it: `renderer`, the renderer's icon coloured by its `--saga-<renderer>` token; or a map note's path (one option per `map` note, by name), the note's pin look on that map (its first `map-pins` entry whose `map` resolves there, its own icon and colour over the renderer's pin look; `resolveLook`) coloured by `--saga-pin-<colour>`, else the renderer's icon. A saved path follows a rename of the map or a folder holding it (`obsidian/prefs.ts`); a path that is no longer a map reads as `renderer`.
- `linkTitles` (Render character titles with wikilinks?): wikilinks to characters with a title field (the character `title` key, remappable) are followed by `, <title>`.

Links to `document` notes, unresolved links and embeds get neither. Source mode shows neither.

## Modules
- `index.ts`: `registerLinkIcons(plugin, config, prefs)`. Registers the editor extension and a Markdown post-processor, and refreshes on a change of any of the three prefs, a config change, a seen note's target change (`metadataCache` `changed`), and vault `create`, `delete` and `rename` (after layout ready).
- `renderers.ts`: `createLinkRenderers(app, config)`: `of(target, fromPath)`, the note's `LinkTarget` (renderer, pin look by map path, character title) after `resolveLink`; `ofFile(file)`, a file's `LinkTarget`, `document` included; `changed(file)`, true when a note's target differs from the one `of` last saw. `lookIcon(target, look)` gives the `LinkIcon` for an icon look (the map's pin look, else the renderer's icon); `linkMarks(target, prefs)` the `LinkMarks` (icon, title) a link shows.
- `syntax.ts`: `wikilinksIn(state, from, to)` (each link's `[[` start, `]]` end and target) walks Obsidian's syntax tree, whose node names are `_`-joined token classes: from a `formatting-link-start` node over `[[` (not `formatting-embed`) to the next `formatting-link-end`; the target is `parseWikiInner` of the text between. Links in code have no such nodes.
- `editor.ts`: `linkIcon(doc, icon)` (`span.saga-link-icon[data-renderer][data-color]` with `setIcon`); `linkTitle(doc, title)` (`span.saga-link-title`); `linkIconsExtension`, a `ViewPlugin` adding an icon widget (`side: -1`) at each link's `[[` and a title widget (`side: 1`) after its `]]` in the visible ranges while `editorLivePreviewField` is on, rebuilt on doc, viewport, syntax tree, mode changes and the `refreshLinkIcons` effect.
- `links.css`.

## Reading view
The post-processor prepends the icon to each `a.internal-link` and puts the title after it, resolving `data-href` from `ctx.sourcePath`. It also covers the blocks Live Preview renders (tables, callouts) and embeds. A refresh dispatches `refreshLinkIcons` to every open editor and calls `previewMode.rerender(true)` on leaves in Reading view.
