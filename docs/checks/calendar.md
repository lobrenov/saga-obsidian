# Calendars: manual checks

Obsidian `>= 1.10.2` on `test/vault` (Saga enabled; `npm run dev` running). Keep `test/vault` under git so each write shows in `git diff`; reset with `git checkout test/vault` between sections that write. Developer console open (⌘⌥I); no errors from `saga` throughout. Run once on desktop and once on mobile, each in light and dark.

Vault facts used below: `Calendars/The Tidereckoning.md` (`type: calendar`; six months, 179 days a year; six weekdays from Moonday; eras The Drowned Age (DA), Before the Lanterns (BL, from 600), Age of Lanterns (AL), The Second Tide (ST, from 1400)). `Lore/` holds 14 notes linked to it with `type` Event, event or Lore: era-only (The Drowning, Lantern Accord), BL years (First Lamp Lit −600, The Long Dark −420 to −380), days (Founding of Saltmere 1 Thawmoon 1, Chain toll raised, The Second Tide rises), day ranges (Festival of Lamps 2–4 Highsun 1312, The Great Storm 28 Emberfall to 12 Frostwane 1312), a month (Herring run fails, Highsun 1312), a year (Siege of Saltmere, 1313), no date (Undated rumour), a month the calendar lacks (Month beyond the year) and an end before its start (Ends before it starts). The Drowning, Founding of Saltmere and The Great Storm have banners. `.saga/renderers.yaml` lists no `calendar` or `lore` types, so the defaults (Calendar; Lore, Event) apply. `Lore/Chronicle.base` has one Saga calendar view per display.

## Calendar note

1. Open `The Tidereckoning`. The header reads CALENDAR, the name, and "6 months · 179 days a year · 6-day week · 4 eras". Months, Week, "Year 1 began on Moonday" and Eras show the note's values; the first Before era reads Earliest and Age of Lanterns reads Year 1 in place of a start. The era strip shows the four eras in order, each as wide as its span, with "← counting back", "year 1" and "counting up →" under it.
2. Rename Seedtide, set its days to 29, Add month, remove it: `git diff` shows only `months` changing. Drag Bloomrise above Seedtide by its grip, then move it back with Alt+↑/↓ on the grip: only `months` changes.
3. Add day "Mistday", drag it first, remove it; choose another first weekday from "Year 1 began on" and back: only `weekdays` and `first-weekday` change. Click the menu button twice: the second click closes the menu.
4. Set Thawmoon's days to 0: "A month needs at least 1 day" shows under the row and the strip stays. Undo it.
5. Add era: "New era" / "NE" is added after The Second Tide with a start after 1400; Add era again gives "New era 2" / "NE2". Set NE2's short name to AL: "Short names must be unique" shows under that row only. Remove both.
6. Rename Age of Lanterns to Age of Lamps: a confirm names the notes using it; Cancel writes nothing; confirming renames `era` in `Lore/Lantern Accord.md` too. Undo with `git checkout test/vault`.
7. Create a new note with only `type: calendar`: Months, Week and Eras show their empty editors with no messages; Add month, Add day and Add era are the dashed pill.

## Lore note

1. Open `Lore/Festival of Lamps`. The header reads LORE with When "2 Highsun 1312 AL", Ends "4 Highsun 1312 AL", the calendar chip, Add where… and Add who…; the footer links the notes just before and after it by date (Herring run fails, Chain toll raised).
2. Hover When: edit and ✕ show on the chip, on one line. Edit (or a click on the date) opens the popover with Era, Year, Month and Day; Day shows Highsun 1312 on the six weekdays with 2 Highsun selected. Pick 3 Highsun: `year`, `month`, `day` change in one write. Esc closes the popover; so does a click outside it.
3. Month: pick Emberfall, so `day` goes. Year: type `700 BL`, then `−12`, then `0` ("There is no year 0"). Era: pick Age of Lanterns: `era` is written and `year`, `month`, `day` go.
4. Set Ends earlier than When: it is refused with a message and nothing is written. ✕ on Ends removes the `end-` keys; Add end is the dashed pill.
5. Open `Lore/Undated rumour`: Set date and Add end are dashed pills. Remove its `calendar` key: Set date asks for a calendar note first; with one calendar in the vault, picking a date writes the `calendar` link with it.
6. Hover the header and its controls: no tooltip names the card, footer or popover parts.

## Saga calendar view

Open `Lore/Chronicle.base`. The view selector lists the three views; the view options show Calendar note (only `The Tidereckoning` offered), Display as, and the chosen display's options only.

### Calendar display

1. It opens on Thawmoon 600 BL, the month of the earliest dated note (First Lamp Lit). Month / Year switch the range; the arrows and PageUp/PageDown step it across year 1 without a year 0.
2. Go to Highsun 1312 AL: Festival of Lamps is a bar over 2–4 Highsun, Chain toll raised sits on 3 Highsun, and Herring run fails is in the "No day set" row. Month beyond the year is under "Date problem". Undated rumour is absent.
3. Click a bar: the card shows the type, the title as a link, the dates and an excerpt; a click elsewhere in Obsidian or Esc closes it. Year shows each month as a small grid with dots on dated days.

### Feed display

1. Entries run oldest first from The Drowning, with era headers, year markers and gap markers between distant entries; Newest first reverses them. Changing the order writes `feed-order` in the base and the base still opens.
2. Banners on: The Drowning, Founding of Saltmere and The Great Storm show their banner; off hides them.

### Timeline display

1. All shows the four eras as columns; each note is a row in the base's order, names left-aligned. Days are diamonds, ranges are bars, a month, year or era is hatched over its length.
2. Century, Decade and Year narrow the window; the overview strip shows the window; PageUp/PageDown step it. A click on a row's name, mark or date opens its card; a click outside closes it.
3. Hover the rows and the list's edges: no "Timeline" tooltip.

### Edit and delete

1. Right-click Festival of Lamps (bar, Feed card or Timeline row): the menu reads "Edit event…" and "Delete event". Lantern Accord reads "lore". Shift+F10 on a focused Timeline name opens the same menu; on mobile, a held touch does.
2. Edit: the dialog "Edit event" shows Title, When and Ends. Change When in its popover; Esc closes only the popover. Rename to Lamp Night and press Update event (or ⌘/Ctrl+Enter): the note is renamed and its dates change in one write.
3. Esc or ✕ with changes writes nothing. A title of an existing note (any case), an empty title, a title with `?`, or Ends before When shows the reason and writes nothing.
4. Delete event: "Delete “Festival of Lamps”?"; Cancel keeps it; Delete moves it to the trash set in Obsidian's Files and links settings.
