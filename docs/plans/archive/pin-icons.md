# Pin icons, colours and shapes: build plan

A pin gets a shape, a colour and an icon. Each comes from the pin's own `map-pins` entry, else from its renderer's pin defaults in `.saga/renderers.yaml`, else from the built-in defaults. Pin styles are replaced by icons.

Design: the Pins page of the [Saga canvas](https://claude.ai/artifact/CgWve4g7RYeu4o3CZJBwLs#page-pins): `Pin icons & colours` (catalogue, shapes, colours, style migration), `Settings: pin defaults`, `Map: pin overrides`.

## Assumptions

- Icons are drawn with Obsidian's bundled Lucide (`getIcon`), so no icon path data ships in the plugin. Every catalogue id exists in the Lucide of Obsidian 1.10.2; an id `getIcon` does not know draws the `circle-small` dot.
- Pin defaults are separate from the renderer's header icon (`rendererDefs[id].icon`): Location's header icon stays `map-pin`, its pin icon is `castle`.
- Colours are stored by name. The renderer colour variables (`--saga-<renderer>`) stay for the header and links; pins use their own variables.

## Format

```yaml
# a note
map-pins:
  - map: "[[The Shattered Coast]]"
    x: 846
    y: 556
    shape: herald     # pin | circle | flag | bookmark | herald
    color: rust       # one of the 12 colour names
    icon: skull       # a catalogue id

# .saga/renderers.yaml
renderers:
  faction:
    pin: { shape: herald, color: indigo, icon: flag }
```

- Every key is optional; a key equal to the default is not written.
- Built-in defaults: shape `pin`; Character `crimson`/`user`, Location `teal`/`castle`, Faction `indigo`/`flag`, Item `ochre`/`gem`, Map `olive`/`map`, Document `umber`/`file-text`.
- Unknown values fall back (shape `pin`, colour to the renderer's, icon to the renderer's) with an issue, as an unknown style does today.
- A `style` reads as an icon: `auto` none, `rumour` `message-circle`, `danger` `skull`, `treasure` `coins`, `quest` `scroll-text`, `camp` `tent`. The next write to that entry replaces `style` with `icon` (an entry with both keeps its `icon`).

## Steps

Each step names its subagent, its done check and what it depends on. Step 1 lands first; steps 2 and 3 touch separate files and run in parallel; step 4 closes.

### 1. Shared model, writes and config
- `src/shared/pins/look.ts`: the catalogue (icon ids, labels, categories as on the canvas), `SHAPES` (outline path, icon box, anchor point on its grid, from the canvas), `PIN_COLORS` (12 names, light and dark hex), `PIN_DEFAULTS` per renderer, `STYLE_ICONS`, and `resolveLook(entry, rendererDefaults)` → `{ shape, color, icon }`.
- `schemas/pins.ts`: `shape`, `color`, `icon` on `mapPinSchema` with lenient fallback; `style` kept as a read-only legacy key. `PinOp` `style` becomes `look` (`{ index, shape?, color?, icon? }`, `null` removes a key); `applyPinOp` migrates `style` on every op that changes an entry.
- `schemas/config.ts`, `configYaml.ts`: optional `pin` per renderer, validated, written by `applyConfigToYaml` with comments and key order kept.
- `src/styles.css`: `--saga-pin-<colour>` light and dark.
- `src/ui/iconPicker.ts`: a `FuzzySuggestModal` over the catalogue showing each icon (`setIcon`) and its label, matching on label and id; used by steps 2 and 3. `test/fakes/obsidian.ts` gains `getIcon`.
- **Agent:** `typescript-dev`.
- **Done:** unit tests written first: resolution order, fallbacks with issues, each `style` migration, a `look` op changing only its entry's keys, config round-trip keeping comments and unknown keys. `npm run typecheck`, `lint`, `test` pass.

### 2. Map view
- `PinSprite`/`pinIcons.ts`/`pinStyles.ts`: one shape symbol per shape and one glyph symbol per icon the map uses (from `getIcon`); a pin draws its shape in its colour variable, the glyph light on light themes and ink on dark. Pins are placed by their shape's anchor (the circle by its centre, the flag by the pole's foot), so `PinLayer`, labels and ghosts read the anchor from `SHAPES` in place of the fixed 32 × 44 tip.
- `collectPins` resolves the look with the config's pin defaults; `PlacedPin.style` becomes `look`.
- Card (`PinPopover`): Shape (menu with the five shapes), Colour (menu of the 12 names), Icon (button opening the icon picker), each with "Use <Renderer> default" when overridden; writes a `look` op. Names read "Title — Renderer, Icon".
- `LayersPanel`: "By icon" replaces "By style"; the Layers renderer dots use the renderer's pin colour.
- **Agent:** `react-dev`.
- **Done:** component tests: each shape placed by its anchor at two zoom levels, overrides and defaults drawn, a card change writes a `look` op and the pin redraws, a `style` entry shows its icon and loses `style` on the next write. Manual checks added to `docs/checks/map.md`.
- **Depends on:** 1.

### 3. Settings
- Settings → Saga gains Pin defaults: one row per renderer with a preview, Shape and Colour dropdowns, an Icon button (icon picker) and Reset when changed. `draft.ts` carries the pin inputs; saving goes through `saveText` as the other inputs do.
- **Agent:** `typescript-dev`.
- **Done:** unit tests on `draft.ts` (draft, save text, rebase with pin edits); a saved `pin` changes the pins on an open map without reload (manual, added to `docs/checks/settings.md`).
- **Depends on:** 1.

### 4. Review, docs, release
- `code-reviewer` over the whole diff; fixes applied.
- As-built updates to `docs/map.md`, `docs/settings.md`, `docs/adapter.md`; `test/vault` gets pins with each shape, overrides and a legacy `style`.
- Version 0.5.0.
- **Done:** all scripts pass; the manual checks pass in `test/vault` in light and dark themes.
- **Depends on:** 2, 3.

## Risks

- Obsidian updates its Lucide; a renamed id draws the dot until the catalogue follows. A unit test lists the catalogue ids for checking against `getIcon` in Obsidian.
