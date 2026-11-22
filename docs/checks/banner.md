# Banners: manual checks

Run on `test/vault` in Obsidian (`npm run dev`, reload the plugin). Notes: `Places/Waterdeep.md` (location), `Characters/Ada Lovelace.md` (character), `Maps/The Shattered Coast.md` (map), `Notes/Type Unknown.md` (document). Image: `Attachments/coast.jpg`. Check `git diff` in the vault after each edit: only the edited key's text changes.

## Display
- [ ] A Location with `image`: the banner spans the pane behind the view header, fades into the note, and the header card overlaps its lower part; Live Preview and Reading view match.
- [ ] Readable line width on and off: the banner always spans the pane; the card keeps the text column's edges; the hover controls sit just above the card's right edge.
- [ ] `cssclasses: [banner-tall]`: the banner is taller and the card moves down with it.
- [ ] Light and dark, Saga theme and the default theme: the view header's title and icons read over a light and a dark image; scrolling turns the header opaque before text reaches it.
- [ ] Source mode, an embed of a note with a banner, and a hover preview: no banner.
- [ ] A note with a banner embedding another note: the embed has no extra space at its top and is clickable.
- [ ] Switch files, modes and panes on one leaf: one banner at most, never duplicated; closing the leaf or disabling the plugin leaves no `saga-banner-*` class or host.

## Saga-rendered notes
- [ ] Character without a banner: the bar shows Add banner; picking `coast.jpg` writes `banner`. A Location writes `image`.
- [ ] With a banner the bar button reads Banner and its menu has Change banner…, Reposition banner, Remove banner; on a Map it reads Map image and has no Remove, neither in the menu nor on the banner.
- [ ] Location, Item and Map have no image frame inside the card.

## Notes without a renderer
- [ ] `Notes/Type Unknown.md`: native title and properties, + Add banner under the title; picking writes `banner` and the note gets a Document card with Banner, Set type and Properties.
- [ ] Set type lists every configured type; choosing one writes `type` and the renderer's header replaces the Document card.
- [ ] Remove banner: the card goes, the native title and properties return.

## Controls
- [ ] Hover shows Reposition, Change banner and Remove; without hover they cannot be clicked or tabbed to (Tab reaches the banner, which shows them).
- [ ] Change banner: popover with the image suggester; Esc closes it and focus returns to the button; a pick writes `[[coast.jpg]]`.
- [ ] Reposition: drag moves the image with the pointer; arrow keys move it; Save position writes `banner-y`; Cancel and Esc write nothing; Esc in another pane does not cancel it.
- [ ] A link to a missing file: "Image not found: …" with the controls visible.
- [ ] Remove: the key and `banner-y` go.
- [ ] A failed write (make the note read-only): the error shows without hovering.

## Mobile
- [ ] A tap on the banner shows the controls, a tap elsewhere hides them, a scroll does not toggle them; buttons are easy to hit.
- [ ] Reposition by dragging with a finger; the controls wrap in a narrow pane.
