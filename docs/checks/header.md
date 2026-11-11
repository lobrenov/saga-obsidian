# Note header: manual checks

Run on `test/vault` in Obsidian (`npm run dev`, reload the plugin). Notes: `Characters/Ada Lovelace.md` (character), `Places/Waterdeep.md` (location), `Factions/Harbor Guild.md` (faction, type `guild`), `Items/Moonblade.md` (item, type `artifact`), `Maps/The Shattered Coast.md` (map), `Maps/Empty Map.md` (map, no image), `Notes/Type Unknown.md` (document). Check `git diff` in the vault after each edit: only the edited key's text changes.

## Display
- [ ] Each renderer note shows its header in Live Preview: Character portrait card, Location/Item/Map image banner, Faction emblem, facts grid, renderer label and icon in the bar.
- [ ] The same notes in Reading view show the header above the content; the native title and properties are hidden.
- [ ] `Notes/Type Unknown.md` and a note with no frontmatter: no header, native title and properties as usual.
- [ ] Source mode: no header, native title and properties visible.
- [ ] Toggle Live Preview, Reading view and Source mode on one note: the header appears and disappears with the mode, once, never duplicated.
- [ ] Settings, Appearance, Readable line width on and off, in Live Preview and Reading view: the header's left edge and width match the text column exactly.
- [ ] Light and dark theme, switched while a header is open: all text, borders, banners and the dashed empty image frame stay legible.
- [ ] A custom theme or accent colour: renderer accent stays on the top rule, badge icon and portrait border.
- [ ] Split pane with the same note twice (one in Live Preview, one in Reading view): each pane has its own header; editing a field in one updates the other.
- [ ] Open `Maps/Empty Map.md` and a character with only `type`: empty fields show their placeholders.
- [ ] Close the leaf, reload the plugin (disable and enable): no header host or `saga-header-active` class is left behind (inspect `.workspace-leaf-content`).

- [ ] Reading view: scroll-to-heading and backlink jumps still land on the right place with the header present.
- [ ] A note embedding another note keeps the embed's own title and properties.

## Properties toggle
- [ ] Properties button off: native properties hidden. On: native properties show below the header (keys outside the renderer's fields, such as `aliases`). Off again: hidden.
- [ ] The toggle is per pane: turning it on in one split leaves the other unchanged.

## Type
- [ ] The Type selector opens an Obsidian menu below it (the macOS menu with Settings → Appearance → Native menus on) listing the types mapped to the renderer in `.saga/renderers.yaml`, the current one checked; choosing another renderer's type (add it to `types` first) redraws the header without reopening the note, and only `type:` changes in the file.
- [ ] Edit `.saga/renderers.yaml` (map `npc` to Character) while a `type: npc` note is open: the header appears without reopening.

## Fields (each edit lands in the file as one key)
- [ ] Text (Title, Kind, Rarity): typing writes once after a pause or on leaving the field, not per keystroke; the cursor stays put when the write lands; Enter leaves the field; Escape restores the saved text; clearing and leaving removes the key.
- [ ] Choice (Status): its menu has the current value checked and no empty item; choosing another writes the value; Clear (hover) removes the key and the placeholder returns.
- [ ] Image fields without a value show a small tinted frame in the image's place (beside the title for portrait and emblem, a slim strip for banners) with the renderer icon; hover shows "Add …", click opens the image suggester in place, Esc cancels.
- [ ] Link chips and Add pills have equal left and right padding, and no text clips, with the Saga theme (IBM Plex Sans) and without it.
- [ ] Link (Location, Region, Leader, Base, Holder, Owner, Origin): the value shows as a chip with the linked note's renderer icon; click opens the note, Cmd/Ctrl-click opens a new tab, hovering with the modifier shows the page preview; the pencil (on hover) edits in place, Esc cancels, the x clears; the suggester lists notes; picking writes `[[Name]]`; clearing and Enter removes the key; an unresolved name is styled as an unresolved link.
- [ ] Press Enter on a highlighted suggestion in a Link or Links input: the picked note is written, not the half-typed text.
- [ ] Links (Allies, Rivals): chips open notes like links; the input adds from the suggester or typed text, a duplicate is ignored; the x removes a chip.
- [ ] Image (Portrait, Emblem, Image): the preview shows the vault image; hovering the frame reveals the input (always shown when empty); the suggester lists only images; picking writes `[[file.png]]`; the trash button removes the key; a name that is not in the vault shows "was not found in the vault".
- [ ] A value that fails the schema (`location: Waterdeep` unquoted): the raw value, the issue and a Convert button show; Convert writes `"[[Waterdeep]]"`.
- [ ] Title: click the name, type, Enter renames the note and links to it update; Escape cancels; `/` or an existing name is refused with a message.
- [ ] Renamed keys (`keys: { portrait: avatar }`): the Portrait field reads and writes `avatar`.

## Editor interplay
- [ ] Type in the body, then edit a header field, then Cmd/Ctrl-Z in the body: the body undo still works and the editor is not corrupted.
- [ ] Edit a header field (wait for the write), then undo in the editor: the editor stays consistent with the file (no stale frontmatter written back on the next keystroke).
- [ ] Type in the body while a header edit lands (type continuously, blur a text field in the header mid-typing): no characters lost, cursor stays in the body.
- [ ] Type in the body, then within about a second edit a header field: both changes are in the file.
- [ ] Hotkeys (Cmd/Ctrl-P, Cmd/Ctrl-O) work while a header input has focus; clicking inside the header does not move the editor cursor or focus the editor.
