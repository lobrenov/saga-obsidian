# PDF export: manual checks

Run on `test/vault` in Obsidian (`npm run dev`, reload the plugin). Export with the file menu, Export to PDF, and open the PDF. Notes: `Characters/Ada Lovelace.md` (character, banner), `Places/Waterdeep.md` (location), `Factions/Harbor Guild.md` (faction), `Items/Moonblade.md` (item), `Maps/The Shattered Coast.md` (map), `Notes/Type Unknown.md` (document, banner). Image: `Attachments/banner.jpg`.

## Renderers
- [ ] Each of the notes above prints its card: renderer label and icon, name, fields; no bar controls, no editors. Empty fields are absent.
- [ ] Character: portrait beside the name and epithet; Faction: emblem beside the name; link chips show the linked note's renderer icon and name; choice values (Status) are capitalised.
- [ ] Location, Item and Map print their `image` as the banner, not inside the card.

## Banner
- [ ] Ada Lovelace: the banner spans the page margins, fades into the page, and the card starts where the fade ends, with no line beside the card's edges; the image is not distorted.
- [ ] `cssclasses: [banner-tall]` makes the banner taller (2:1 against 3:1).
- [ ] `banner-y: 0` and `banner-y: 100` show the top and the bottom of the image.
- [ ] A `banner` naming a missing image: no banner, no broken-image icon; the card prints.
- [ ] A note without a banner prints no banner.

## Document
- [ ] `Notes/Type Unknown.md` prints a Document card (with its banner).
- [ ] Remove its `banner` and set Render a header on untyped notes? on: the card prints; off: no card, and with Include file name as title on, core's title prints.
- [ ] With a card printed, Include file name as title on: the title appears once (in the card).

## Page and theme
- [ ] A4, A5 and Letter, default margins: the content fits; at A5 the portrait or emblem stacks above the name and facts are one column; at A4 and Letter they sit side by side.
- [ ] The card does not split across a page break; long notes continue on the next page.
- [ ] App in light and in dark theme: the PDF looks the same (light).
- [ ] A note with no Saga card or banner exports as before.
- [ ] Export twice in a row, and two notes one after the other: one block each, no leftover from the first.
