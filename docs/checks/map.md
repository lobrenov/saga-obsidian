# Map view: manual checks

Obsidian `>= 1.10.2` on `test/vault` (Settings → Community plugins → Saga enabled; `npm run dev` running). Keep `test/vault` under git so each write shows in `git diff`. Developer console open (⌘⌥I); there should be no errors from `saga` throughout.

Vault facts used below: `Maps/The Shattered Coast.md` (`type: map`, `image: "[[coast.jpg]]"`), `Maps/Empty Map.md` (`type: map`, no image), `Places/Waterdeep.md` (type `Location`; pins at 952,720 `rumour` and 10,20 `sparkly`, plus three broken or foreign entries), `Items/Moonblade.md` (type `artifact`; pin at 300.5,410 `treasure`), `Factions/Harbor Guild.md` (type `guild`; pin at 640,500 `shape: herald`), `Places/Docks/Harbor Master.md` (type `location`; pin at 820,600 `shape: circle`, `color: sea`, `icon: anchor`), `Characters/Ada Lovelace.md` and `Characters/Bob.md` (type `character`, `NPC`; no pins).

## Setup

1. Create `Maps/Pins.base` (right-click `Maps` → New base) with this content:

   ```yaml
   filters:
     and:
       - file.ext == "md"
   views:
     - type: saga-map
       name: Coast
   ```

2. Open it. The view selector lists "Saga map" with the map icon. The view shows "Choose a map note in the view options."
3. Open `Maps/Pins.base` as text and confirm what the `map` option stores (a vault path, or a `[[link]]`); both are accepted. View options (the toolbar's view settings): the Map note field lists only `The Shattered Coast` and `Empty Map` when you type `Maps/`; `Waterdeep`, `Bob` and the others are absent. Choose `Maps/The Shattered Coast.md`; the options also show "Layers panel", on. Pin labels are in Saga's settings tab ("Pin labels": always or on hover).

## Step 3: read

### Stage

1. The coast image fills the pane, fitted. Four pins stand on it with labels beside them: Waterdeep (the Location colour, the message-circle glyph its legacy `rumour` style reads as), Moonblade (the Item colour, the coins glyph for `treasure`), Harbor Guild (a herald in the Faction colour with the flag glyph) and Harbor Master (a sea-coloured circle with the anchor glyph, its bottom on 820,600). A pin without its own `shape`, `color` or `icon` takes its renderer's. Waterdeep's second pin at 10,20 (`sparkly`) is at the top left with the Location default icon (castle). The broken Waterdeep entries (`x: wrong`, no `y`, `[[Nowhere Map]]`) draw nothing.
2. Hover a pin's pixel position against the readout at the bottom left: it shows `x · y` in image pixels and a zoom level; the Moonblade tip reads about 300 / 410.
3. Two-finger scroll pans; pinch (or ⌘-scroll) zooms around the pointer; drag pans; double-click, the `+` and `-` buttons and the `+`/`-` keys zoom one level; arrow keys pan when the map has focus; Fit map refits. Panning stops with a quarter of the image (or the whole image if smaller) still in view.
4. Zoom out as far as it goes: the longest image side is about 64 px. Zoom in as far as it goes: 8x native.
5. Resize the pane and split it: the stage refills without moving the image's centre.

### Pin card, open and hover

1. Click the Moonblade pin: a card appears beside it with "Item", "Moonblade", an excerpt (`Held by Ada Lovelace.`), the Shape (Pin), Colour (Ochre) and Icon (Coin) rows and a close button; no Open note, Move or Remove buttons and no "Pin saved in" line. The title is a link and has focus; Esc, the close button or a click on the map closes the card and focus returns to the pin. The selected pin looks like the others (same size and colour, same label).
2. Click the Waterdeep pin at 10,20: the card lists "Unknown pin style "sparkly"; using auto" and Icon reads Castle.
3. Click the card title: `Moonblade` opens in the current tab. Reopen the map, select the pin again, ⌘-click (Ctrl on Windows or Linux) the title: it opens in a new tab and the map stays. Hovering the title shows the page preview (with ⌘/Ctrl unless Page preview says otherwise).
4. Settings → Core plugins → Page preview is on. Hover a pin while holding ⌘ (Ctrl): the note's hover preview appears. Settings → Page preview lists "Saga map" as a source; turning its modifier requirement off shows the preview on a plain hover.

### Filtering and colour

1. Edit `Maps/Pins.base` filters to `type == "location"` (UI: Filter → add `type` `is` `location`): only Waterdeep's and Harbor Master's pins remain (Moonblade's `artifact` type does not match). Change to `type == "artifact"`: only Moonblade.
2. Add a pin to a character first (see Step 4, "Add pin"; pick `Ada Lovelace`). With the filter `type == "character"` only the Ada pin shows, in the Character pin colour; `NPC` notes count as characters through `.saga/renderers.yaml`, so a pin on `Bob` shows too with the same colour. Restore the filter to `file.ext == "md"`.
3. Layers panel: it lists the renderers on the map (Characters, Locations, Factions, Items) with a dot in each renderer's pin colour and, when the pins use more than one icon, a "By icon" group with each icon's glyph in a neutral colour. Unticking Locations hides the Waterdeep pins; unticking Coin hides Moonblade. Setting the view option "Layers panel" off hides the panel and shows every pin again. Switching the Saga setting "Pin labels" to on hover removes every label until a pin is hovered or focused; the open map updates at once.
4. In `.saga/renderers.yaml` change the `location` types to `[place]` and save: within a moment the Waterdeep pins take the Document pin colour and icon and the Layers panel counts them under Documents, with no reload. Revert it.

### Live updates

1. Open `Places/Waterdeep.md` in a second pane next to the map. Change `x: 952` to `x: 600` in the editor: the pin moves on the map without reloading or reopening anything. Remove the first `map-pins` entry: its pin disappears.
2. Change a pin's `map` link to `[[Empty Map]]`: the pin leaves The Shattered Coast. Change it back.
3. Rename `Maps/The Shattered Coast.md` through the file explorer: links update; the view option still names the old path, so the view shows "Maps/The Shattered Coast.md is not in the vault." Choose the renamed file again and the pins return.

### Empty states

1. Map note option `Maps/Empty Map.md`: "Empty Map has no image, or its image link does not resolve."
2. Set `image: "[[missing.png]]"` on a copy of the map note and choose it: the same message.
3. Rename the `image` key in `.saga/renderers.yaml` (`renderers.map.keys: { image: picture }`), rename the property in the map note to `picture`: the map shows. Revert both.
4. Change the chosen note's `type` to `document`: "… is not a map note."
5. Delete the Map note option (clear the field): the "Choose a map note" message.
6. Watch the open card while the base updates (edit any other note): the excerpt does not blink or reload.
7. Close the view's tab: no `saga-map-view` element remains in the DOM and the console is clean. Use a `.base` with the view opened in a sidebar pane and in two splits: each draws its own pins and the pin glyphs render in every pane (no missing shapes after closing one of them).

## Step 4: edit

Each write must show in `git diff` as a change of the `map-pins` value only: no other key, comment, line ending or blank line moves in the note, and the map note is never touched. Check this after every action below. Start from a clean `git status`.

### Add pin

1. Right-click an empty spot of the map: an Obsidian menu opens at the pointer with "Add pin here" (and no other items). Right-click on a pin opens the pin menu instead. There is no Select / Add pin toggle in the header.
2. Focus the map (Tab) and press the ContextMenu key (or Shift+F10): the same menu opens at the middle of the view and the pin goes at the view centre.
3. Choose "Add pin here": a note picker opens over the base's notes (the map note is not listed). Dismiss it with Esc: nothing is written, the ghost goes.
4. Right-click again, type `lovelace`, choose `Characters/Ada Lovelace`: the ghost holds the clicked spot, then becomes the Ada pin in the same spot; `git diff` shows a `map-pins` list added to the end of the front matter with `map: "[[The Shattered Coast]]"`, `x`, `y` with at most one decimal and no `shape`, `color`, `icon` or `style`.
5. Right-click, type `Quillon` (no such note), choose "Create note "Quillon"": the base's new-note flow runs. When the note exists it gets the pin at the clicked spot: `git diff` shows `Quillon.md` with the new `map-pins` and the front matter the base applies (filter values, template) intact. Check both orders: (a) the pin lands after the new note is fully written, with no lost front matter; (b) if `createFileForView` resolves before the note exists, or its menu is cancelled, a notice reads "The note was not created; no pin was added." and no pin is written. Record which happens.
6. With the vault read-only on disk (`chmod -w Characters/Bob.md`), add a pin to Bob: an Obsidian notice shows the error, the ghost disappears and no pin is added. `chmod +w` afterwards.

### Move

1. Drag the Moonblade pin 100 px: it follows the pointer, and on release it stays on the drop point. While the write is pending (a slow disk, or watch the drop closely) it does not jump back; once written the pin stays. `git diff`: only `x` and `y` of that entry changed, to one decimal.
2. Drag a pin outside the map pane, then release: it returns to where it was; nothing is written. A click without movement past 4 px selects it and writes nothing.
3. With `Places/Waterdeep.md` open in the editor in a second pane, drag one of its pins: the editor text updates to the new coordinates, the cursor and unsaved typing in other parts of the note are not lost, and undo in the editor reverts the change (the file follows).
4. Conflict case: in the second pane type in the note body, and in the same moment drag a pin of that note. The note ends with both the typed text and the moved pin, or the drag fails with a notice; it never loses the typing.
5. Stale index: with the map open, edit `Places/Waterdeep.md` in an external editor (outside Obsidian) to put a different `map-pins` entry above the rumour one, and before Obsidian reindexes drag the rumour pin. The entry matching its old coordinates changes, not the one that moved into its position. If the entry is no longer there, a notice reads "That pin is no longer in the note. Its map may have changed." and the file is unchanged.

### Look

Each write changes only the keys of that entry's `map-pins` item (`shape`, `color`, `icon`); a legacy `style` of the entry is replaced by its icon.

1. Select Moonblade and click Shape: an Obsidian menu opens below it with Pin, Circle, Flag, Bookmark and Herald, the current one checked. Choose Flag: `shape: flag` is added to that entry and the pin redraws as a flag at once, standing on the same image point (the bottom centre of its outline, as for every shape).
2. Click Shape again and choose Pin (the renderer's default): the `shape` line is removed. Repeat with Circle, Bookmark and Herald: each stands on the same image point (the bottom centre of its outline) at the fit zoom and zoomed in.
3. Click Colour: a menu of the 12 colour names, the current one checked. Choose Rust: `color: rust`; the pin and the card's renderer line take it. Choose the Item's own colour (Ochre): the `color` line is removed.
4. Click Icon: Obsidian's icon picker opens with each icon drawn beside its label; typing filters on label and id. Choose Skull: `icon: skull` and the pin's glyph changes; the Icon button shows Skull. Pick Gem (the Item default): the `icon` line is removed. Esc in the picker writes nothing.
5. With Moonblade overridden (its `treasure` style reads as Coin), the Icon row has a reset button (tooltip "Use Item default") to the right of its dropdown, which narrows to fit it; Shape and Colour have none until changed. Click it: `style` or `icon` is removed from that entry and the pin takes the Item icon.
6. Select Waterdeep's 10,20 pin (unknown `sparkly` style): choose Skull; `icon: skull` replaces `style: sparkly` and the issue on the card disappears.
7. Add `pin: { shape: flag, color: sea, icon: tower-control }` to `renderers.location` in `.saga/renderers.yaml`: the Waterdeep pin keys it does not set redraw at once as sea-coloured flags; the Layers dot for Locations is sea; the card's reset button ("Use Location default") returns an overridden pin to them.

### Remove

1. Right-click a pin: a menu with "Remove pin". Choose it: an Obsidian dialog asks "Remove this pin from Moonblade.md?" Press Keep (or Esc): nothing is written, the pin stays.
2. Choose Remove pin again, then Remove pin in the dialog: the pin goes. `git diff`: that entry is gone from `map-pins`; the other entries of the note (including the broken Waterdeep ones) and every other key are untouched. Removing the last entry of a note removes the `map-pins` key.
3. `git checkout test/vault` restores the vault.

### Keyboard route

1. Tab into the map: the stage takes focus (focus ring), then each pin in turn; Enter on a pin opens its card; Tab moves to the title link, Shape, Colour, Icon and Close; Enter or Space on Shape or Colour opens its menu, arrow keys and Enter choose; Enter on Icon opens the icon picker. The ContextMenu key (Shift+F10) on a pin opens its menu at the pin.
2. A pin tabbed to outside the view pans into view.

### Labels and pin look

1. Pin markers: the shape in its colour with a light outline and the icon inside it, light on a light theme and dark ink on a dark one; each shape stands on the bottom centre of its outline (zoom in on a pin and compare with the readout). A selected pin is not larger or darker.
2. Pins close together (zoom out on a crowded area): labels go right, else left, else below (level with the icon, clear of the shape, for every shape), and never cover a pin or another label. A pin with no free slot has no label until hover or focus, when it appears on top.
3. Labels stay unclipped at the view's edge after panning settles. Pins draw above labels.
4. Light and dark themes: outlines, glyphs, labels, clusters and focus rings (Tab to a pin and a cluster) read clearly.
   Pin names: a screen reader (or the accessibility tree) reads each pin as "Title — Renderer, Icon label".
5. Pin labels on hover (Saga settings): no labels at rest; hover one pin and only its label shows; Tab to a pin and its label shows.
6. The view fills the pane's height with one background; no band of another colour under the map, in either theme.

## Mobile (iPhone, iPad)

Saga installed through BRAT on the device; open the base with the Saga map view.

1. One finger on the map (on the image, on the margin around it, from near the screen's edge) pans it and never opens Obsidian's side drawers; one finger on a pin drags it and writes once on release, as with a mouse.
2. Two fingers pinch: the map zooms around the fingers and follows them as they move. No page zoom, no jump at the end of the pinch.
3. A second finger while dragging a pin: the pin returns to its place and nothing is written; the two fingers pinch.
4. Press and hold the map (about half a second, without moving): the menu opens at the finger with "Add pin here"; lifting the finger leaves the menu open. Press and hold a pin: "Remove pin", and the pin's card does not open. No text selection or iOS callout appears.
5. A finger that moves before the hold time pans and opens no menu.
6. Tap a pin: its card opens; tap the title to open the note. Tap the map: the card closes. Double-tap the map: it zooms one level.
7. The map header shows the map name and a Layers button, and no Pins button. Layers opens the layer toggles in a column beside the map; the map narrows to fit. Unticking a layer hides its pins; closing the column keeps them hidden. With the view option "Layers panel" off, there is no Layers button.
8. On desktop the header shows only the map name and the Layers panel floats over the map as before.
