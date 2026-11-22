# File explorer icons (as built)

Settings → Saga → File explorer, in `data.json`:
- `fileIcons` (Render file icons?, default off): file explorer rows show an icon. Folders show `folder-closed` while collapsed and `folder-open` while expanded, in place of the arrow; Markdown notes show their icon in the shared `linkIconLook` (`docs/links.md`): the renderer's icon in its `--saga-<renderer>` colour, or the note's pin look on the chosen map in its `--saga-pin-<colour>` (the renderer's icon when it has no pin there). Other files show none.
- `fileIconsUntyped` (Render icons for untyped files?, default on, disabled while `fileIcons` is off): notes whose renderer is `document` show the `document` icon (or their pin look on the chosen map); off, they show none.

## Modules
- `dom.ts`: every explorer selector. `titlesIn(root)` (`.nav-file-title[data-path]` and `.nav-folder-title[data-path]`), `isFolder`, `pathOf`, `setTitleIcon(title, icon)` (a `.saga-file-icon` in a folder's `.collapse-icon` or before a file's `.tree-item-inner`, kept when equal, removed for null), `removeIcons(root)`.
- `index.ts`: `registerFileIcons(plugin, config, prefs)`. The icon is `linkIcon` (`links/editor.ts`) over `createLinkRenderers(...).ofFile` and `lookIcon`. A MutationObserver on each `file-explorer` leaf's container draws rows as the explorer adds them; leaves are picked up on layout ready and `layout-change`. It redraws all rows on a change of `fileIcons`, `fileIconsUntyped` or `linkIconLook`, a config change and vault `rename`, and a note's rows on `metadataCache` `changed`. Unloading removes the icons.
- `explorer.css`: size, spacing and vertical centring (a zero-width `::before` gives the icon the row's baseline, as Obsidian's `.tree-item-icon`); hides the folder arrow and shows `.saga-folder-closed` or `.saga-folder-open` by the collapse icon's `is-collapsed`; colours come from `.saga-link-icon` (`links/links.css`).
