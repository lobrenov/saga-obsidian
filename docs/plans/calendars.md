# Calendars: build plan

A **Calendar** renderer for notes that define a world's calendar (`type: calendar`), a **Lore** renderer for dated notes (`type: lore` or `event`), and a **Saga calendar** Bases view that shows the base's dated notes on one calendar as a month grid, a feed or a timeline. Designs: the Calendars page of the Saga canvas.

## Data

The model copies maps: the dated note links to the calendar, the calendar note is never edited by date changes, and the view picks the calendar.

| Map | Calendar |
|---|---|
| Location note: `map-pins: [{ map, x, y }]` | Lore note: `calendar`, `era`, `year`, `month`, `day`, `end-*` |
| Map note: `type: map`, `image` | Calendar note: `type: calendar`, `months`, `weekdays`, `first-weekday`, `eras` |
| View option `map`; a pin shows when its `map` link resolves to it | View option `calendar`; an entry shows when its `calendar` link resolves to it |

Calendar note:

```yaml
type: calendar
months:
  - { name: Thawmoon, days: 30 }
  - { name: Seedtide, days: 30 }
weekdays: [Moonday, Tideday, Netday, Saltday, Lampday, Restday]
first-weekday: Moonday        # weekday of 1 <first month> 1
eras:                         # earliest first
  - { name: The Drowned Age, short: DA, side: before }
  - { name: Before the Lanterns, short: BL, side: before, start: 600 }
  - { name: Age of Lanterns, short: AL, side: after }
  - { name: The Second Tide, short: ST, side: after, start: 1400 }
```

Dated note (Lore), one number per key, flat so Bases can sort and filter on them:

```yaml
type: event
calendar: "[[The Tidereckoning]]"
year: 1312        # 1 BL is -1; there is no year 0
month: 4          # 1-based index into months
day: 28
end-year: 1312    # optional; same shape as the start
end-month: 6
end-day: 12
```

- Precision is the finest key present: `day`, `month`, `year`, or `era` alone (`era: Age of Lanterns`, era-only dates only). Finer keys without coarser ones are invalid.
- Years count continuously from year 1; an era names a span and gives the label (`1312 AL`). A `before` era's `start` counts back (600 → `-600`); the first era on each side has no `start` (the earliest runs back without end, the first `after` era starts at year 1). Eras in order, `before` eras first.
- Sorting compares year, month, day; at equal prefixes the coarser date sorts first (`1312` < `Highsun 1312` < `3 Highsun 1312`). Era-only dates sort at their era's start.

## Assumptions
- Only the Lore header edits dates. The view reads any note in the base whose `calendar` resolves to the chosen calendar, as the map view reads any note's pins.
- The date keys keep their names (no `keys` renames) in this version.
- `era` holds the era's name. Renaming an era in the calendar note renames it in every note whose `calendar` resolves to that calendar (`era` and `end-era`); an `era` that matches no era (edited by hand) shows an issue, like an unknown pin value.
- A Lore note without `calendar`: the date editor asks for one first (a suggester over calendar notes), and uses the only one when the vault has exactly one.
- No Today, leap rules, extra days, moons, seasons or repeating events. The view does not edit dates (no dragging, no "New event on this day").

## Steps

Step 1 comes first. Steps 2, 3 and 4 can then run in parallel (separate files). Steps 5 and 6 build on 4.

### 1. Calendar maths and schemas (`src/shared/calendars`)
- `schema.ts`: zod schemas for the calendar note's keys (months ≥ 1 with days ≥ 1, weekdays ≥ 1, `first-weekday` one of them, eras ordered `before` then `after`, starts increasing in time) and for a note's date keys; issues for invalid values, as `schemas/pins.ts` does.
- `dates.ts`: `CalendarDate` (`{ era } | { year, month?, day? }`), `readDate(frontmatter, prefix)`, `compareDates`, `eraOf(year)`, `eraSpan(era)`, `formatDate` (`28 Highsun 1312 AL`, `Highsun 1312 AL`, `1312 AL`, `Age of Lanterns`), `dayOfYear`, `daysInYear`, `weekdayOf`, `monthGrid(year, month)` (leading and trailing days), `dateKeys(date, prefix)` (the keys to write and to remove).
- **Agent:** `typescript-dev`.
- **Done:** unit tests first: validation of each key; 1 BL → -1 and back; era of a year at each boundary; sort order including mixed precision and BL years; weekday of a day on each side of year 1; month grid offsets; formatting at each precision. `typecheck`, `lint`, `test` pass.

### 2. Calendar renderer and header (`calendar`)
- `RENDERER_IDS`, `rendererDefs`, `PIN_DEFAULTS`, `--saga-calendar` and `-tint` (slate blue, light and dark), config default `types: [calendar]`, explorer icon `calendar-days`.
- Layout in `src/header/layouts.tsx` (its own component, not field editors): Months table (name, days, drag to reorder, add, remove), Week chips (add, remove, reorder), "Year 1 began on" select, Eras table (side, name, short, start; first era of each side has a fixed start), and the era strip.
- Writes: each control replaces one key's whole value with `setField` (`months`, `weekdays`, `first-weekday`, `eras`).
- Era rename: committing a changed era name finds the notes whose `calendar` resolves here and whose `era` or `end-era` holds the old name. None: write `eras` only. Some: a confirm `Modal` ("Rename Age of Lanterns to Age of Lamps in 3 notes?", Rename / Cancel); Rename writes `eras`, then each note's keys with `setField`, and a Notice lists any note that failed. Cancel restores the old name.
- **Agent:** `react-dev`.
- **Done:** component tests: each editor writes the expected YAML and only its key; invalid entries show their issue; the strip follows the data; an era rename updates `era` and `end-era` in linked notes only, asks only when notes use it, and Cancel writes nothing. `typecheck`, `lint`, `test` pass.

### 3. Lore renderer and date editor (`lore`)
- `RENDERER_IDS`, `rendererDefs` (fields: `calendar` link, `where` link, `who` links; the date fields below), `PIN_DEFAULTS`, `--saga-lore` and `-tint` (plum), config default `types: [Lore, Event]`, explorer icon `scroll-text`.
- New field kind `date` with a key prefix (`''` for When, `end-` for Ends). `FieldView` reads it with `readDate` and writes it with a new adapter function `setFields(app, file, entries)`: one `vault.process` that sets and removes several keys, changing only their text.
- Date editor: the box shows `formatDate`; the popover has the precision switch (Era / Year / Month / Day), an era list grouped Before / From year 1 (Era), a year input with era label (Year), month list (Month), month grid with month and year navigation (Day). Choosing writes the keys for that precision and removes finer ones. Ends is empty until added and is refused when earlier than When.
- Footer: the previous and next Lore note on the same calendar (by `compareDates`).
- **Agent:** `react-dev`.
- **Done:** component tests: each precision writes and removes the right keys in one write; BL years; Ends before When is refused; no `calendar` → suggester first, and the only calendar is used without asking. `setFields` adapter tests (text preserved around the keys). `typecheck`, `lint`, `test` pass.

### 4. Saga calendar view, Calendar display (`src/calendar`)
- `index.ts`: `registerCalendarView` → Bases view `saga-calendar` ("Saga calendar", icon `calendar-days`). Options: `calendar` (`file`, filtered to calendar notes), `display` (`dropdown`: Calendar / Feed / Timeline), then per display, hidden by `shouldHide` reading `config.get('display')`: Calendar `opens` (Month / Year), Feed `order` (Oldest first / Newest first) and `banners` (toggle), Timeline `scale` (All / Century / Decade / Year). In-view controls write the same config keys.
- `entries.ts`: `collectEntries(app, config, files, calendar)` as `collectPins`: the base's notes whose `calendar` resolves to the chosen note, with their dates, renderer and issues.
- `CalendarRoot.tsx`: header (range title, calendar link, navigation), empty states (no calendar chosen, not a calendar note, invalid calendar), then the display.
- Calendar display: month grid on the calendar's weekdays, multi-day bars across cells and rows, the "No day set" row for month and year dates in range, Year range as twelve (or N) small months; the entry card (renderer, title link with hover preview, date, excerpt), as the pin card.
- **Agent:** `react-dev`.
- **Done:** component tests over the fake App: options hide by display; entries from other calendars and notes outside the base are absent; grid offsets and spans; no-day row; card opens and links. Bundle test still loads.

### 5. Feed display
- Central spine; cards alternate sides; era headers; gap markers between entries more than a year apart; a year marker where entries share a year; dot by precision. Banner preview (96 px) from `bannerOf` when `banners` is on.
- **Agent:** `react-dev`.
- **Done:** component tests: order both ways, coarse-before-fine at equal prefixes, era headers and gap lengths, banners on and off.

### 6. Timeline display
- One row per entry in the base's sort; day points, date-to-end bars (open-ended when they start before the range), hatched spans for month, year and era dates; month columns sized by days at Year scale, years at Decade and Century, eras at All; the era overview strip with the visible range.
- **Agent:** `react-dev`.
- **Done:** component tests: positions at each scale; open-ended bars; overview window follows navigation.

### 7. Docs and test vault
- `docs/calendar.md` (as built), `docs/header.md` (Calendar and Lore layouts, `date` kind), `docs/adapter.md` (`setFields`), `CLAUDE.md` layout line for `src/calendar`, `docs/checks/calendar.md`.
- `test/vault`: The Tidereckoning, a dozen Lore notes across eras and precisions, a few with banners, and `Chronicle.base` with one view per display.
- **Done:** manual checks pass on desktop and mobile, light and dark.

## Not covered
- Leap rules, extra days, moons, seasons, repeating events, a world Today.
- Editing dates from the view.
- Dates on renderers other than Lore.
- Renaming date keys in `.saga/renderers.yaml`.
