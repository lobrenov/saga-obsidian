# Map view (as built)

A Bases view (`saga-map`) that draws the pins of the base's notes on the image of one map note. A map is a note (`type: map`, `image: "[[coast.jpg]]"`); pins live in the `map-pins` frontmatter of the notes they point at (`{ map: "[[…]]", x, y, style? }`, image pixels, one decimal). The map note is never edited by pin changes.

## Modules (`src/map`)
- `index.ts`: `registerMapView(plugin, config, prefs)` registers the hover source `saga` (`defaultMod: true`) and the view `saga-map` ("Saga map", icon `map`). Options: `map` (a `file` option whose filter accepts markdown notes the config resolves to the `map` renderer) and `layers` (toggle, default on). Pin labels come from the plugin setting `pinLabels` (`PrefsStore`), not a view option. Imports `map.css`.
- `MapBasesView.ts`: the `BasesView`. Mounts React in a `saga-map-view` div, renders on `onDataUpdated` and on config and prefs changes, caches the host while the map path is unchanged, unmounts and removes the div on unload. It carries `hoverPopover` as the hover parent.
- `mapState.ts`: `mapStateOf(app, config, input)` turns the option values and the base's files into a `MapState`: `empty` with a message (no map chosen, not in the vault, not a map note, no image or an image link that does not resolve) or `map` (host, title, image URL, pins, `labels` (`'always' | 'hover'`), `layers`). The `map` option may hold a vault path, a `[[link]]` or a bare name. The image is read from the map note's `image` field under the key `renderers.map.keys.image` renames it to.
- `labels.ts`: `placeLabels`, label slot placement.
- `pins.ts`: `collectPins` and `mapLinkFrom`. `types.ts`: `PlacedPin`, `pinKey` (`path#index`), `MapState`.
- `host.ts`: `MapHost` (what the stage asks of its surroundings) and `createHost(app, map, ui)`. `HostUi` is the part that opens Obsidian UI: `pickNote`, `confirmRemove`, `notify`, `hoverNote`, `showMenu(at, items)`. The host itself works over `App` alone (link text and resolution, writes, `openLinkText`, `cachedRead`), so component tests drive the real stage with a scripted `HostUi` over the fake App.
- `obsidianUi.ts`, `modals.ts`: the `HostUi` for Obsidian.
- `pinWrites.ts`: `entryMatcher`, `locateEntry`.
- `MapRoot.tsx`: header (map name, Pins · n), loads the image to get its pixel size, shows the stage or the empty message. Gives each view its own SVG sprite id prefix.
- `MapStage.tsx`, `MapCanvas.tsx`, `PinLayer.tsx`, `PinPopover.tsx`, `LayersPanel.tsx`, `PinList.tsx`, `Controls.tsx`, `PinSprite.tsx`/`pinIcons.ts`/`pinStyles.ts`, `viewportStore.ts`, `trackpad.ts`, `geometry.ts`, `excerpt.ts`: the stage (single image only). `shared/maps/viewport.ts` holds the viewport maths.

## Pins
- `collectPins(app, config, files, map)`: for each markdown file of the base (not the map note) read `frontmatterOf`, parse `map-pins` with `parseMapPins`, and keep the entries whose `map` link resolves, from the note holding it, to the map note. Title is the file's basename; renderer comes from `config.rendererOf`; an unknown style becomes `auto` with an issue; invalid entries are skipped. Notes outside the base's filter show no pins.
- A pin is coloured by its note's renderer, always, with `--saga-character`, `--saga-location`, `--saga-faction`, `--saga-item`, `--saga-map` or `--saga-document` (defined in `src/styles.css`, light and dark). The style shows only through its glyph in the head (dot, ring, triangle, diamond, star, square). The marker is a 32 × 44 teardrop with a light (`#fbf8f2`) outline and glyph, its tip (16, 43) on the pin's image point; a selected pin looks like any other. Names read "Title — Renderer[, style]".
- New pins write `mapLinkFrom`: `[[linktext]]` from `fileToLinktext(map, notePath, true)`.

## Writes
- Every change goes through `updatePins(app, file, build)` in `obsidian/vault.ts`: inside `vault.process` the `build` callback receives the note's current raw `map-pins` list and returns a `PinOp` (`add`, `move`, `remove`, `style`) or null; only the `map-pins` value text changes. Null (the pin is gone) fails with "That pin is no longer in the note…" and leaves the file.
- The stage builds the op with `locateEntry(list, pin.index, entryMatcher(isMap, x, y))`: the entry at the pin's index when it still has the same map (via `host.isMap`), x and y; else the one entry that does; none or several → null.
- Hold until reported: a moved pin is shown at its written point (`held`) until the base reports a position other than the one before the write, the write fails (the pin returns and `notify` shows the message), or 3 s pass. A new pin's ghost stays until the base lists one more pin, or 3 s. Drag moves use this path.
- Successes raise no notice; failures raise an Obsidian Notice.

## Behaviour
- Layout: the Bases container is a column (`saga-map-container`) and the view fills it, with one background (`--background-primary`) for the header, stage and any letterbox around the image.
- Stage (`MapCanvas`): a focusable container (`data-map-stage`) holds one 0×0 layer; the store's subscription writes `translate3d` and `scale(2^zoom)` to its style (no re-render). The `<img data-map-image>` sits at its natural size inside. An untransformed overlay above holds pins and ghosts. A single image zooms out until its longest side is about 64 px and in to 8x.
- Input: two-finger scroll or wheel pans; pinch (Ctrl+wheel, `gesture*` in WebKit) or ⌘+wheel zooms around the pointer; drag pans after 4 px; double-click, the zoom buttons and `+`/`-` zoom one level (animated unless Reduce Motion); arrows pan 80 px; Fit map refits. Focusing a pin off screen pans it in. The readout shows the pointer's image pixel and the zoom level.
- Pins (`PinLayer`): one button per pin placed from the viewport subscription. Pin buttons reset Obsidian's button styles (`.saga-map button.saga-map-pin`). Pins and clusters more than 150 px outside the view are culled (`data-culled`, hidden but focusable; focus places them). Above 50 pins, `clusterItems` groups them on a 56 px screen grid, regrouped 150 ms after the zoom settles; the selected, dragged and focused pins stay single and the closest zoom never clusters. A cluster zooms to its pins and focus moves to the first.
- Labels (`placeLabels`): with `pinLabels: 'always'` each pin's label (12 px pill) goes in the first of right, left and below the pin where it covers no pin, cluster or earlier label and lies inside the view, placed top to bottom then left to right. Widths are estimated from the text length. Labels are in their own layers, so pins always draw above them. A pin with no free slot shows its label (right of the pin, on top of everything) only on hover or focus. With `'hover'` no label is drawn until a pin is hovered or focused. Placement runs with clustering (150 ms after the zoom settles) and again after a pan settles.
- Card (`PinPopover`; click or Enter on a pin): renderer, the note's title as a link (opens the note, in a new tab with ⌘/Ctrl; hover preview), excerpt (`cachedRead`, first lines, 140 chars), style menu select (`src/ui/MenuSelect.tsx`), pin issues. It sits beside the pin, follows it and returns focus on close. Esc, the close button or a click on the map closes it; Esc is handled only for focus inside the view.
- Map menu (`Menu`; right-click on the map away from a pin, or the ContextMenu key / Shift+F10 on the focused stage, at the view centre): "Add pin here" calls `pickNote`, then writes `{ map, x, y }` to the chosen note (no style; set it on the card). Cancelling the picker removes the ghost.
- Pin menu (right-click on a pin, or the ContextMenu key / Shift+F10 on it): "Remove pin", after a confirm `Modal`.
- Move: drag a pin; it writes once on release inside the map (clamped to the image); a release outside returns the pin.
- Layers: by renderer (dot in the renderer colour) and by style (the style's glyph in a neutral colour); only what the map has is listed. The `layers` option hides the panel. Hidden layers apply only while the panel is shown.
- Keyboard route: the Pins list (sorted by title, one button per pin; selecting centres the map on it and opens its card).

## What Obsidian provides
- Note picker (`modals.ts`): a `FuzzySuggestModal` over the base's notes except the map note, matching on the path. A last item "Create note "<typed text>"" calls the view's `createFileForView(name, callback)` and pins the file the callback received; with no file a Notice says so and nothing is written.
- Remove pin: a `Modal` ("Remove this pin from X.md?", Remove pin / Keep) and the `Menu` items of the map and pin menus.
- Open note: the card title calls `workspace.openLinkText(path, mapPath, false)`; ⌘/Ctrl-click uses `'tab'`.
- Hover preview: `workspace.trigger('hover-link', { event, source: 'saga', hoverParent: view, targetEl, linktext, sourcePath })` on pointer-over of a pin and of the card title; the source needs ⌘/Ctrl unless Page preview is set otherwise.
- Styling: `map.css` on Obsidian's variables and classes (`saga-map-*`, `mod-cta`, `mod-warning`, `clickable-icon`, `dropdown`).
