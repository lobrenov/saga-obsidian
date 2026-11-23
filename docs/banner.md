# Banners (as built)

Any note in Live Preview or Reading view can show a banner: an image across the full width of the pane, behind the view header, fading into the note, with the note header's card (`docs/header.md`) over its faded lower part. No banner in Source mode, embeds or hover previews.

## Keys
- The image: `image` (with the config's renames) for renderers whose definition sets `banner: 'image'` (Location, Map); `banner` for every other note, with or without a renderer. A wikilink to an image (`[[coast.jpg]]`).
- `banner-y`: the image's vertical `object-position`, a whole percentage 0–100; missing or invalid is 50.
- Height from the note's `cssclasses`: 300 px, or 440 px with `banner-tall`.

`bannerOf(def, keys, frontmatter)` (`src/shared/renderers/banner.ts`) returns `{ key, link, y, removable }`; `removable` is false for Map, whose image is the map.

## Behaviour
- Every note with a banner has a header card, whose bar's banner control (`docs/header.md`) changes, repositions and removes it; the banner itself has no controls outside reposition mode.
- Change banner opens the image suggester in a popover; a pick writes the key as `[[target]]`; Esc or leaving closes it and focus returns to its trigger.
- Remove removes the key, then `banner-y`.
- Reposition: dashed outline, a "Drag the image to reposition" status with Save position and Cancel at the right, just above the card (at the readable column's edge when readable line width is on); a vertical drag (pointer capture) moves the image 1:1, ArrowUp and ArrowDown move it by 1 (Shift: 10); Save position writes `banner-y`; Cancel or Esc in the leaf writes nothing. A failed write shows there as an alert.
- A link that does not resolve, or an image that fails to load, shows "Image not found: <target>".
- A note without a renderer shows the Document card, with Add banner in its bar. With the `documentCard` pref off it shows Obsidian's title with **+ Add banner** under it instead; a pick writes `banner`, and the note then gets the Document card while it has the banner.
- The view header is transparent over the banner, with a 56 px scrim at the image's top; it takes its background back once content would reach it.

## Modules
- `dom.ts`: every selector. `placeBanner` (host before `.cm-scroller > .cm-sizer` or `.markdown-preview-view > .markdown-preview-sizer`), `placeAdd` (after `.inline-title`), `markBanner` (`saga-banner-active` on the leaf content), `leafOf`, `watchScroll` (`saga-banner-scrolled`, from scroll events of the host's own scroller).
- `controller.ts`: `createBannerController(env, config)` with `sync(views)`, `reposition(key)` and `dispose()`. One React root per leaf with a banner, or per `document` leaf without one while `documentCard()` is off (the Add host); keyed by file path, so a file switch leaves reposition mode. A draw is skipped when its signature is unchanged. `src/header/index.ts` creates it before the header controller and syncs both from the same leaves.
- `Banner.tsx`: image, scrim, reposition mode, missing image. `AddBanner.tsx`: the Add button.
- `useBannerPicker.tsx`: picker state, write, popover (`BannerPicker.tsx`, a labelled group around the suggester input) and alert, shared by the Add button and the header's banner control. `useWrite.ts`: `setField` keeping a failed write's message; `removeBanner`.
- `banner.css`: `--saga-banner-height`, `--saga-banner-overlap` (96 px), the view header states, the padding of the view's own sizer (embeds untouched), fade, reposition controls, 44 px targets on a coarse pointer, focus outlines.
