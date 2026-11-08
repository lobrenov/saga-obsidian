# Note header: manual checks

Run on `test/vault` in Obsidian (`npm run dev`, reload the plugin). Notes: `Characters/Ada Lovelace.md` (character), `Places/Waterdeep.md` (location), `Factions/Harbor Guild.md` (faction, type `guild`), `Items/Moonblade.md` (item, type `artifact`), `Maps/The Shattered Coast.md` (map), `Maps/Empty Map.md` (map, no image), `Notes/Type Unknown.md` (document). Check `git diff` in the vault after each edit: only the edited key's text changes.

## Display
- [ ] Each renderer note shows its header in Live Preview: Character portrait card, Location/Item/Map image banner, Faction emblem, facts grid, renderer label and icon in the bar.
- [ ] The same notes in Reading view show the header above the content; the native title and properties are hidden.
- [ ] `Notes/Type Unknown.md` and a note with no frontmatter: no header, native title and properties as usual.
- [ ] Source mode: no header, native title and properties visible.
- [ ] Toggle Live Preview, Reading view and Source mode on one note: the header appears and disappears with the mode, once, never duplicated.
- [ ] Settings, Appearance, Readable line width on and off: the header follows the content width (off: same side margins as the text).
- [ ] Light and dark theme, switched while a header is open: all text, borders, banners and the dashed empty image frame stay legible.
- [ ] A custom theme or accent colour: renderer accent stays on the top rule, badge icon and portrait border.
- [ ] Split pane with the same note twice (one in Live Preview, one in Reading view): each pane has its own header; editing a field in one updates the other.
- [ ] Open `Maps/Empty Map.md`: the Missing required banner names `image`; the Image field is outlined as required. Set the image: the banner disappears.
- [ ] A character without `role` or `location`: banner lists both note keys (after renames: `avatar` for portrait is only a rename of an optional field, no banner).
- [ ] Close the leaf, reload the plugin (disable and enable): no header host or `saga-header-active` class is left behind (inspect `.workspace-leaf-content`).

- [ ] Reading view: scroll-to-heading and backlink jumps still land on the right place with the header present.
- [ ] A note embedding another note keeps the embed's own title and properties.

## Properties toggle
- [ ] Properties button off: native properties hidden. On: native properties show below the header (keys outside the renderer's fields, such as `aliases`). Off again: hidden.
- [ ] The toggle is per pane: turning it on in one split leaves the other unchanged.

## Type
- [ ] The Type selector lists the types mapped to the renderer in `.saga/renderers.yaml`; choosing another renderer's type (add it to `types` first) redraws the header without reopening the note, and only `type:` changes in the file.
- [ ] Edit `.saga/renderers.yaml` (map `npc` to Character) while a `type: npc` note is open: the header appears without reopening.

## Fields (each edit lands in the file as one key)
- [ ] Text (Role, Title, Kind, Rarity): typing writes once after a pause or on leaving the field, not per keystroke; the cursor stays put when the write lands; Enter leaves the field; Escape restores the saved text; clearing and leaving removes the key.
- [ ] Choice (Status): selecting writes the value; the empty option removes the key.
- [ ] Link (Location, Region, Leader, Base, Holder, Owner, Origin): the value shows as a link; click opens the note, Cmd/Ctrl-click opens a new tab, hovering with the modifier shows the page preview; the pencil edits; the suggester lists notes; picking writes `[[Name]]`; clearing and Enter removes the key; an unresolved name is styled as an unresolved link.
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
