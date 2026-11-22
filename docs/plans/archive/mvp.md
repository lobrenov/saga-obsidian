# Saga for Obsidian: MVP build plan

An Obsidian plugin carrying two Saga functions:

- **Map view**: a Bases view that draws the pins of the base's notes on an image.
- **Note renderers**: a header that replaces the inline title and properties of a note whose `type` maps to a renderer; Obsidian's editor stays below.

Source repo for ports: `../Saga` (`main` at `eb1dc20`).

## Assumptions

- Obsidian `>= 1.10.2` (`minAppVersion`): `registerBasesView`, `BasesView`, the `file` view option with a filter. Typings pinned to `obsidian@1.14.4`.
- Desktop only (`isDesktopOnly: true`).
- Vault format is Saga's: pins in `map-pins` (`{ map: "[[…]]", x, y, style? }`, image pixels, one decimal), renderer types from `type`, the shipped renderers `character`, `location`, `faction`, `item`, `map`, `document`.
- React stays (bundled) so `renderer/maps` and `renderer/renderers` port rather than rewrite. Styles move from CSS modules to one `styles.css` on Obsidian's CSS variables.
- Frontmatter writes go through `vault.process` with Saga's text-preserving edits (`setFrontmatterKey`, `applyPinOpToText`), so only the changed key's text changes. `fileManager.processFrontMatter` re-serialises the whole block and is not used.
- Single image maps only; no tile pyramid (Saga tiles in Rust).
- Personal distribution first (BRAT or manual install); community-directory guidelines are followed but not submitted.

## Decisions

1. A pin's `map` links to a map note (`type: map`, `image`), as in Saga; the view's `file` option selects that note.
2. One vault works in both the Tauri app and the plugin: same `map-pins` and `.saga/renderers.yaml`.
3. The header is editable; a toggle reveals the native properties for keys outside the renderer's fields.
4. The header shows in Live Preview and Reading view; Source mode is untouched.
5. Pin editing (add, move, restyle, remove) is in the MVP.
6. Image cards are the header's only; no Bases card view.
7. Maps larger than the WebView decodes comfortably (~16k px side) are out of scope.

## Layout

```
src/
  shared/      ported from Saga src/shared, no Obsidian or DOM imports
  obsidian/    the adapter: frontmatter read, link resolve, resource URLs, writes
  map/         Bases view and the map stage (ported renderer/maps)
  header/      header injection and renderer layouts (ported renderer/renderers)
  settings/    settings tab
  main.ts      Plugin: registers the view, header, settings
test/
  unit/        Vitest over shared/ and the adapter (fake App)
  vault/       test vault, opened in Obsidian for manual checks
```

## Reuse from Saga

| Saga | Here | Change |
|---|---|---|
| `shared/wikilink.ts`, `result.ts`, `schemas/issues.ts` | `shared/` | none |
| `shared/frontmatter/*` | `shared/frontmatter` | none |
| `shared/schemas/pins.ts`, `shared/pins/{ops,cluster}.ts` | `shared/pins` | none |
| `shared/maps/viewport.ts` | `shared/maps` | drop tile helpers |
| `shared/renderers/*`, `schemas/config*.ts` | `shared/renderers` | none |
| `renderer/maps/{viewportStore,trackpad,geometry,pinStyles,pinIcons,PinSprite}` | `map/` | none |
| `renderer/maps/{MapCanvas,PinLayer,PinPopover,Controls,LayersPanel,PinList,NewPinPanel}` | `map/` | `invoke`/react-query replaced by the adapter; note picker becomes a `SuggestModal` |
| `renderer/maps/{MapView,MapStage,Tiles,mapData}` | `map/MapBasesView` | rewritten around `BasesView.onDataUpdated` |
| `renderer/renderers/{layouts,cards,FieldView,fieldEditors}` | `header/` | `NoteSession` replaced by adapter writes; `LinkInput` by Obsidian suggest |
| `renderer/renderers/settings/RenderersView` | `settings/` | rebuilt on `PluginSettingTab` |

Not ported: the Rust backend, index, search, cache, watcher, tiles, rename, templates, library and ⌘K (Obsidian has its own).

## Steps

Each step names its subagent, its done check, and what it depends on. Steps 3–4 (map) and 5–7 (header) are independent after step 2 and can run as two parallel subagents or sessions on separate worktrees.

### 1. Scaffold
- `package.json` (exact pins: `obsidian`, `esbuild`, `typescript`, `vitest`, `eslint`, `react`, `react-dom`, `zod`, `yaml`), `manifest.json` (id `saga`), `tsconfig.json`, `esbuild.config.mjs`, ESLint with `shared/` forbidden from importing `obsidian` or the DOM.
- `npm run dev` watches and writes `main.js`, `manifest.json`, `styles.css` into `test/vault/.obsidian/plugins/saga/`.
- `test/vault`: a subset of Saga's `test/fixtures/vault` (a map note and image, pinned characters and locations, one note per renderer, broken pins).
- **Agent:** `typescript-dev`.
- **Done:** `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass; the plugin enables in Obsidian on `test/vault` with no console errors.

### 2. Shared core and adapter
- Copy the `shared/` modules in the reuse table with their Saga unit tests.
- `obsidian/vault.ts`: `frontmatterOf(file)` (`metadataCache`), `resolveLink(link, from)` (`getFirstLinkpathDest`), `resourceUrl(file)` (`vault.getResourcePath`), `setField(file, key, value)` and `applyPinOp(file, op)` (`vault.process` with Saga's text edits), `onChanged(file, cb)`.
- **Agent:** `typescript-dev`.
- **Done:** the ported Saga tests pass unchanged; adapter tests on a fake `App` show a pin write changes only the `map-pins` value text (BOM, CRLF and comments kept).
- **Depends on:** 1.

### 3. Map Bases view (read)
- `registerBasesView('saga-map', …)` with a `file` option for the map (filtered per question 1) and toggles for layers and labels.
- `onDataUpdated`: collect each entry's `map-pins` entries whose `map` resolves to the chosen map; pins of notes outside the base's filter are not shown.
- Port the stage: viewport store, pan and pinch, zoom buttons, fit, readout, clustering above 50 pins, culling, pin popover with Open note (`workspace.openLinkText`, ⌘-click new tab) and hover preview (`hover-link`).
- Pin colour and glyph by the note's renderer and style, as in Saga.
- **Agent:** `react-dev`.
- **Done:** component tests (Vitest browser, fake adapter) for placement, clustering and selection; manual checklist in `test/vault`: a base filtered to `type = character` shows only character pins; editing a note's `map-pins` in another pane moves the pin without reload.
- **Depends on:** 2.

### 4. Map Bases view (pin editing)
- Add pin (ghost, click, note picker over the base's entries with "Create note" through `createFileForView`), drag to move, arrow-key move, style, remove (asks first). All writes through `applyPinOp`, locating the entry by map, x and y as in Saga's `pinWrites`.
- Keyboard route: the Pins list.
- **Agent:** `react-dev`.
- **Done:** adapter tests for each op against a fake vault; manual checklist: each op writes only `map-pins` (diff in git), and the pin keeps its drop point until the write lands.
- **Depends on:** 3.

### 5. Note header (display)
- Per `MarkdownView` leaf, on `file-open`, `layout-change` and `metadataCache` `changed`: resolve the renderer (`createRendererResolver`); for any renderer but `document`, add `saga-header` to the view, mount the React header before `.inline-title` (Live Preview) and `.mod-header` (Reading view), and hide `.inline-title` and `.metadata-container` under that class. Unmount on file change and plugin unload.
- Layouts from Saga: Character (portrait card), Location and Item (image banner), Faction (emblem), Map (image banner, "Open in a base" if one has a saga-map view on it). Fields as styled facts; links open with `openLinkText` and show hover previews; the Missing required banner.
- A "Properties" toggle shows the native properties below the header (decision 3).
- **Agents:** `ui-designer` for the header styles on Obsidian variables (light, dark, readable line width on and off); `react-dev` for injection and layouts.
- **Done:** component tests per layout over fixture frontmatter; manual checklist across both modes, theme switch, split panes showing the same note, and a `type` change applying without reopening.
- **Depends on:** 2.

### 6. Note header (editing)
- Port `FieldView` and `fieldEditors`; link and image inputs use `AbstractInputSuggest` over vault files. Writes through `setField`; a cleared field removes its key.
- **Agent:** `react-dev`.
- **Done:** adapter tests for each field kind; manual: an edit lands in the file, and undo in the editor is not broken by it.
- **Depends on:** 5.

### 7. Settings
- Type key, types per renderer, key renames, with Saga's config issues shown inline. Stored in `.saga/renderers.yaml` through `applyConfigToYaml` (decision 2); external edits of the file reload the config.
- **Agent:** `typescript-dev`.
- **Done:** a test that a saved config round-trips through `parseConfig` with comments and unknown keys kept; manual: remapping `npc` to Character re-renders an open `type: npc` note.
- **Depends on:** 2.

### 8. Review and docs
- `code-reviewer` over the whole diff; fixes applied.
- `README.md` (install, the two features), `docs/` as-built pages for the map view and the header, `CLAUDE.md` (purpose, scripts, layout).
- **Done:** all scripts pass; the manual checklists pass in a clean install of the built plugin.
- **Depends on:** 4, 6, 7.

## Risks

- The header depends on Obsidian's DOM (`.inline-title`, `.metadata-container`, `.mod-header`), which is not API. The injection is one module with a manual check on each Obsidian update.
- `vault.process` writes to an open note go through Obsidian's file sync into the editor; a header field edit or pin write while the user types in the same note's body is the conflict case to check in steps 4 and 6.
