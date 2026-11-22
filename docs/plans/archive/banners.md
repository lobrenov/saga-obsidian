# Banners: build plan

Any note in Live Preview or Reading view can show a banner: an image across the full width of the pane, behind the view header, fading into the note, with the note header's card over its faded lower part. Notes whose renderer already draws `image` as a banner (Location, Item, Map) keep using `image`; every other note, with or without a renderer, uses `banner`. A note without a renderer gets the header card while it has a banner. `banner-y` sets the image's vertical position. Mock-ups: the Saga canvas, Banners page.

## Assumptions

- Keys: `banner` and `banner-y` are fixed (not in the config's renames); `image` keeps its renames (`config.renderers[renderer].keys.image`).
- `banner` and `image` take an image wikilink (`[[file.png]]`) only, as image fields do today; no URLs.
- `banner-y` is an integer 0–100, the image's `object-position` y in percent; missing or invalid is 50.
- Height is set by CSS classes in the note's `cssclasses`, added by hand: none is 300 px, `banner-tall` is 440 px. Obsidian puts `cssclasses` on `.markdown-source-view` and `.markdown-preview-view`, so the classes reach the banner through CSS alone.
- No banner in Source mode, embeds or hover previews.

## Behaviour

| | Saga-rendered note | Note without a renderer (`document`) |
|---|---|---|
| Banner key | `image` for Location, Item, Map; `banner` for Character, Faction | `banner` |
| Banner set | full-bleed banner, header card over its faded part | the same, with a Document card |
| No banner | header card as today; bar button **Add banner** | Obsidian's inline title and properties; **+ Add banner** under the title |
| Bar button, banner set | **Banner** (Map: **Map image**): Change, Reposition, Remove (Map: no Remove) | the same |
| Hover controls above the card | Reposition, Change, Remove (Map: no Remove) | the same |

- **Document card**: the `document` renderer's badge, colour and icon; bar with Banner, the Type selector and the Properties toggle; the title alone in the body. The Type selector shows "Set type" and lists every configured type (all renderers' `typesOf`); choosing one writes `typeKey`, and the next sync draws that renderer's header. Native properties hide behind the Properties toggle, as on Saga notes.
- **Add / Change** open the image suggester (`env.suggest(input, 'image', …)`) in a popover; a pick writes the key with `setField`; Esc cancels.
- **Remove** removes the key and `banner-y`; a Document card then goes and the note returns to Obsidian's title and properties.
- **Reposition**: the banner shows a dashed outline and "Drag the image to reposition"; a vertical drag moves `object-position`; **Save position** writes `banner-y`, **Cancel** or Esc restores it. Pointer events, so touch drags too.
- **View header**: while a banner shows, the view header is transparent over it; it takes its background back once the note scrolls past the banner.
- On touch, the hover controls show after a tap on the banner.
- The empty dashed banner frame inside Location, Item and Map headers goes; the bar button replaces it.

## Steps

### 1. Banner source (shared)
- `src/shared/renderers/define.ts`: optional `banner` on a renderer definition, naming the image field drawn as its banner. `definitions.ts`: `banner: 'image'` on `location`, `item`, `map`.
- `src/shared/renderers/banner.ts`: `bannerOf(def, keys, frontmatter)` → `{ key, link: WikiLink | null, y: number, removable: boolean }`. `key` is the renamed `image` key when `def.banner` is set, else `banner`; `link` parses with the image field's schema; `removable` is false for `map`.
- `resolve.ts`: `allTypes(config)`, every renderer's `typesOf` except `document`, for the Document card's Type selector.
- **Agent:** `typescript-dev`.
- **Done:** tests first. Unit: Location reads `image` (and a renamed key), Character and Document read `banner`; a Character note with only `image` has no banner; `banner-y` clamps to 0–100, non-numbers give 50; Map is not removable; `allTypes` lists configured types and ids for unconfigured renderers. `typecheck`, `lint`, `test` pass.

### 2. Banner view
- `src/banner/dom.ts`: every selector the banner uses. `placeBanner` puts the host before the view's sizer (`.cm-scroller > .cm-sizer`, `.markdown-preview-view > .markdown-preview-sizer`), absolutely positioned across the scroller; `placeAdd` puts the **+ Add banner** host after `.inline-title`; `markBanner` toggles `saga-banner-active` on the leaf's `.workspace-leaf-content`, which lays the view header over the view content (transparent) and pads the sizer's top by the banner height less the overlap; `watchScroll` toggles `saga-banner-scrolled` (view header background back) once the scroller passes the banner.
- `src/banner/controller.ts`: `createBannerController(env, config)` with `sync(views)`, `reposition(key)` and `dispose()`, one React root per leaf, mirroring the header controller (signature skip, `watchPlacement`, unmount on Source mode or no file). Document notes without a banner get the Add host.
- `src/banner/Banner.tsx`: the image (`resolveLink`, `resourceUrl`), bottom fade (`mask-image`), hover controls, reposition mode. `AddBanner.tsx`: the button and suggester popover.
- `src/banner/banner.css`: `--saga-banner-height` (300 px; `.banner-tall` 440 px), fade, controls, view header states; hidden inside `.markdown-embed`, `.internal-embed` and hover popovers.
- `src/header/index.ts`: creates the banner controller beside the header controller and syncs both from the same leaf iteration.
- **Agent:** `react-dev`.
- **Done:** tests first. Component: a Location note with `image` draws the banner from `image`; a Document note with `banner` draws it; without one the Add button shows under the title and a pick writes `banner: "[[x.png]]"`; `banner-tall` on the view sets 440 px; Remove deletes the key and `banner-y`, and is absent on a Map; Reposition then a 50 px drag and Save writes `banner-y`, Esc writes nothing; the view header is transparent with a banner and gets `saga-banner-scrolled` past it; Source mode and embeds have no banner. `typecheck`, `lint`, `test` pass.
- **Depends on:** 1.

### 3. Header: bar control and Document card
- `controller.ts`: a note resolving to `document` mounts a header when `bannerOf` has a link, and unmounts when it has none.
- `types.ts`, `registry.tsx`, `layouts.tsx`: `HeaderRendererId` gains `document`; `DocumentLayout` is the title alone. Location, Item and Map drop `field('image', 'saga-header-banner')`; `header.css` drops `.saga-header-banner`.
- `NoteHeader.tsx`: `BannerControl` between the badge and the Type selector: **Add banner** with the suggester popover, or **Banner** / **Map image** with a `showMenu` menu (Change, Reposition, Remove per `removable`). Reposition calls a new `onRepositionBanner` prop, wired to the banner controller's `reposition(key)`. `TypeField` on a Document card lists `allTypes` with the placeholder "Set type".
- `header.css`: under `saga-banner-active` the header pulls up over the banner's faded part.
- **Agent:** `react-dev`.
- **Done:** tests first. Component: a Document note with `banner` gets a Document card with Banner, Set type and Properties; choosing a type writes `typeKey`; removing its banner removes the card; the bar shows Add banner without a banner and Banner with one; Map's button reads Map image and its menu has no Remove; the menu's Reposition puts the banner into reposition mode; Location's body has no image frame. `typecheck`, `lint`, `test` pass.
- **Depends on:** 2.

### 4. Docs and release
- As-built: `docs/banner.md` (new), `docs/header.md` (bar control, Document card, layouts without banners), `CLAUDE.md` (layout gains `src/banner`; the header covers Document notes with a banner).
- `docs/checks/banner.md`: Live Preview and Reading view, light and dark, Saga theme and default theme, readable line length on and off, `banner-tall`, a Document note, a Map, the view header while scrolling, mobile.
- Version 0.8.0.
- **Agent:** none (main session).
- **Done:** the checks pass in `test/vault`; all scripts pass.
- **Depends on:** 3.

## Decisions

- One banner per note: Location, Item and Map have no separate `banner` key.
- Every note with a banner shows the header card; a note without a renderer shows the Document card only while it has a banner.
- Removing a Map's image is left to the Properties panel; the banner offers no Remove.
- Height comes only from CSS classes; Saga has no height control.
- Banners never render in Source mode, embeds or hover previews.

## Risks

- Placing a host beside the sizer and padding the sizer in Live Preview may disturb CodeMirror's measuring; if it does, the banner moves inside the sizer and breaks out of the readable width with negative margins (`--file-margins`). `banner/dom.ts` holds every selector, so the change stays there.
- Laying the view header over the content changes Obsidian's leaf layout; other plugins or themes styling `.view-header` may clash.
- Obsidian may re-create the scroller's children on mode or file changes; `watchPlacement` re-places the host as it does for the header.
