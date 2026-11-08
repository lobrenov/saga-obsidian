# Note header (as built)

A note whose `type` maps to a renderer other than `document` gets a React header in Live Preview and Reading view, in place of Obsidian's inline title and properties. `src/shared/renderers` holds the React-free definitions; `src/header` pairs them with layouts and field editors.

## Modules
- `index.ts`: `registerHeader(plugin, config)`. Registers the hover source `saga-header`, syncs on `file-open`, `layout-change`, `active-leaf-change`, `metadataCache` `changed`, vault `rename`, `create` and `delete`, on `config.subscribe`, and once from `onLayoutReady`. Collects the Markdown views with `workspace.iterateAllLeaves` and passes `{ containerEl, file, mode }` per leaf to the controller. Mode: `getMode() === 'preview'` is `reading`, `getState().source === true` is `source`, otherwise `live`. Unload sets a disposed flag (later syncs do nothing) and disposes the controller.
- `controller.ts`: `createHeaderController(env, config)` with `sync(views)` and `dispose()`. One React root and one host element (`.saga-header-host`) per leaf key. `sync` resolves `config.rendererOf(frontmatterOf(app, file))`; leaves in Source mode, without a file or resolving to `document` are unmounted. `NoteHeader` is keyed by the file path, so a file switch in the same leaf unmounts the old tree (pending text edits flush to their own note) and mounts a new one. A draw is skipped when its signature (path, frontmatter, resolution, config text, Properties state) is unchanged. A mode change remounts the leaf; the Properties state is kept.
- `dom.ts`: all knowledge of Obsidian's markup (below), `placeHost`, `markActive`, `watchPlacement`, `isolatePointer`.
- `NoteHeader.tsx`: the section for one note: `role="status"` region, bar, layout inside `LayoutBoundary`.
- `registry.tsx`, `layouts.tsx`, `types.ts`: `defineRendererView(def, Layout)` validates the frontmatter (`readFrontmatter` with the config's key renames) and gives the layout `title` and `field(name, className)`. `rendererRegistry` covers `character`, `location`, `faction`, `item` and `map`.
- `FieldView.tsx`, `fieldEditors.tsx`: one field and one editor per kind.
- `NoteTitle.tsx`, `Icon.tsx`, `LayoutBoundary.tsx`, `header.css`.
- `env.ts`, `host.ts`: `HeaderEnv` and its Obsidian implementation.

## DOM (dom.ts)
- Live Preview sizer: `.markdown-source-view .cm-sizer`. Reading view sizer: `.markdown-preview-view .markdown-preview-sizer`.
- The host goes before the sizer's child `.mod-header` or `.inline-title` (`:scope >` lookup), else before the first child other than itself. `placeHost` returns false when the sizer is absent and does not touch the DOM when the host is already in place.
- `markActive` toggles `saga-header-active` on the view's `containerEl`, and `saga-header-properties` while active and the toggle is on. `header.css` hides `.inline-title`, and `.metadata-container` without the properties class, under the active class, except inside `.markdown-embed` and `.internal-embed`.
- `watchPlacement` observes the sizer's children and its parent's children and calls `place` again (host and classes) on change; until the sizer exists it observes the whole view.
- `isolatePointer` stops `mousedown` and `click` at the host; key events bubble.
- Width: the host is `width: 100%` of the sizer, which Obsidian already caps at `--file-line-width` (readable width on) and pads with the scroller's `--file-margins`; the header's left edge and width equal the text column's in Live Preview and Reading view.

## Layouts
Each renderer has an accent and tint from the `--saga-<renderer>` and `--saga-<renderer>-tint` tokens in `src/styles.css` (fallback: Obsidian's colour variables). The bar (tinted) shows the renderer's icon (`setIcon`) and label, the Type selector and the Properties toggle. Inside:
- Character: portrait card (152×192) beside the name, `title` (epithet), and facts role, affiliation, location, status.
- Location: image banner, name, facts kind and region.
- Faction: emblem beside the name and facts kind, leader, base, allies, rivals.
- Item: image banner, name, facts kind, rarity, holder, owner, location, origin.
- Map: image banner and name.

Every image field keeps its frame in its real place. A set image fills the frame (portrait 152×192, emblem 112×112, banners 180 px high) with change and remove controls on hover. An empty one is a quiet dashed frame of the same place, tinted with the renderer's `-tint` token, with the renderer icon centred (portrait 120×150, emblem 96×96, banner 72 px high); "Add portrait" shows on hover and focus, and click opens the image suggester input in place (Esc cancels). Facts are a grid of fields. A layout that throws falls back to the title alone and logs to the console. The status region is always mounted and lists the required note keys (after renames) that are missing or invalid: "Missing required for the X renderer: keys".

## Fields
`FieldView` shows the label, the editor, a "required" mark, and for a value failing its schema the raw value, the issue and, when `convertRaw` finds a safe conversion, a Convert button (a `setField` with the converted value). A failed write shows `role="alert"`. All writes go through `src/obsidian/vault.ts` with the note key from the config's renames; a cleared field removes its key.

| Kind | Editor | Write |
|---|---|---|
| text | auto-growing textarea | `setField`, string; empty removes the key |
| list | chips and an input | `updateField`: append, or remove the first equal entry |
| link | link chip (edit and remove on hover) or an add button; the input with file suggester opens in place, Esc cancels | `setField`, `[[target]]`; empty or remove clears the key |
| links | link chips (remove on hover) and an add button that opens the suggester input in place | `updateField`: append unless a link with that target exists, or remove the first entry with that target |
| image | frame with hover controls (change opens the image suggester input over the frame, remove), or the empty frame as the add button | `setField`, `[[file]]`; remove clears the key |
| choice | select (placeholder only while empty) and a Clear button on hover | `setField`; Clear removes |

- Text: the draft is committed 600 ms after the last keystroke (`COMMIT_DELAY_MS`), on blur, and on unmount. Enter blurs; Escape restores the last known saved text. `useDraft` keeps the user's draft while the field has focus when the cache delivers a value, and tracks the last written value so an unchanged value is not written twice.
- List and links writes use `updateField`, which builds the new array from the note's text at write time, so successive edits before the metadata cache updates all land.
- File inputs (`FileInput`) attach the suggester once per input; picking commits, and the Enter that chose a suggestion is not committed again. Link text typed without picking is committed on Enter or blur as `[[typed]]`. Image inputs take picks only.
- Values reach the header again through `metadataCache` `changed`, which triggers a sync.

## Title
`NoteTitle` shows the basename as a heading button. Click edits; Enter or blur commits through `app.fileManager.renameFile(file, folder + name + '.' + extension)`, so Obsidian updates links. Escape cancels. Empty names, names containing `\ / : * ? " < > | # ^ [ ]` and names of existing files are refused with an alert.

## Type selector
Lists the types mapped to the renderer (`typesOf`); a current value outside them stays selectable. Choosing writes the config's `typeKey` with `setField`; the next sync redraws with the new renderer, or removes the header when the type maps to `document`.

## Properties toggle
Per leaf, kept in the controller. On: the leaf gets `saga-header-properties` and Obsidian's native properties show below the header (all keys). Source mode has no header and shows the native UI.

## Links and hover
`LinkChip` shows the linked note's renderer icon (coloured by its `--saga-<renderer>` token) and `alias ?? basename ?? target`; a link that does not resolve (`resolveLink`) gets `is-unresolved` and an unlink icon. Click calls `env.openLink(target, notePath, event)`; a Cmd/Ctrl-click opens a new tab. Mouse-over calls `env.hover`, which triggers `hover-link` with source `saga-header`. Images resolve with `resolveLink` and `resourceUrl`.

## HeaderEnv and host
`HeaderEnv` (`env.ts`) is what the header takes from Obsidian besides the `App`: `openLink`, `hover`, `setIcon` and `suggest(input, kind, from, onPick)`. `host.ts` implements it with `workspace.openLinkText` and `Keymap.isModEvent`, `workspace.trigger('hover-link', …)`, `setIcon`, and an `AbstractInputSuggest` over Markdown files or image files ranked by `prepareFuzzySearch`, reporting `fileToLinktext`. Only `host.ts` and `index.ts` import runtime values from `obsidian`; the rest takes the env from `HeaderCtx`, so tests supply `testEnv` (`test/fakes/header.ts`) over the fake `App`.
