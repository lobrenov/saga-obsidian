# PDF export (as built)

Obsidian's **Export to PDF** prints a note's banner and header card, read-only, sized to the page. Core renders the note into a hidden popout window and never sees the leaf's DOM, so Saga adds a static block to that render. Desktop only.

## Modules
- `index.ts`: `registerPrint(plugin, config, prefs)` registers a Markdown post-processor. Outside the print root it does nothing. Per root (a `WeakMap` from root to promise, so every section's call gets the same promise) it prepends a host `div` to the root, renders `PrintNote` for `ctx.sourcePath`'s file, the current config and the `documentCard` pref with `createRoot` and `flushSync`, then resolves when every `img` in the host has loaded or failed and the banner is faded. A banner whose image failed gets `hidden`. The banner `img` (`data-path`, `data-y`) then takes `fadedBanner`'s data URL from the file's `readBinary`; an unreadable file keeps the unfaded image. A `MarkdownRenderChild` added with `ctx.addChild` unmounts the React root on unload. The host and root use the root's own document (`ownerDocument`); `setIcon` is the global one.
- `dom.ts`: the print root selector, `.print .markdown-preview-view`, and `printRootOf(el)`.
- `fade.ts`: `fadedBanner(data, ratio, y)` crops the image to the banner's ratio at `y`, as `object-fit: cover` does, fades it to transparent from 45% down (the screen's mask) and returns a PNG data URL, at most 2000 px wide.
- `PrintNote.tsx`: the banner and the header card, under the header controller's rule (a renderer other than `document`, or `document` with the pref on or a banner). `data-banner-tall` is set from `cssclasses`. Needs a `HeaderCtx` whose env has only `app` and `setIcon`.
- `PrintField.tsx`: one read-only field per kind; nothing for empty values, values failing their schema, or an image that does not resolve. Link chips show the renderer icon and name.
- `PrintLayout` (`src/header/registry.tsx`): each renderer's layout with `PrintField` as its `field`.
- `print.css`.

## Layout
- The block reuses `.saga-banner` and `.saga-header*` markup, so `header.css` and `banner.css` style it; their on-screen positioning is scoped to `saga-header-active` and `saga-banner-active` leaves and does not apply. `print.css` removes the banner's mask, scrim and background.
- `.saga-print` is an inline-size container, so rules follow the print root's width at print time: A4 with default margins 500-649px, A5 400-499px. The root is 1024px wide while post-processors run, so width is never measured in script.
- Banner: `aspect-ratio: 3 / 1`, or `2 / 1` with `banner-tall`; `object-fit: cover`, `object-position` from `banner-y`; the image is the faded crop, with no mask or scrim.
- Card: accent and tint by renderer (`--saga-<renderer>` tokens); overlaps a shown banner's faded foot by `10cqw` (30% of a 3:1 banner, 20% of a 2:1 one); `break-inside: avoid`. Nothing in the block has a shadow. Chips have the header's chip padding and accent-coloured icons. Choice values are capitalised; image fields have no label.
- Under 500px: the portrait or emblem stacks above the name; facts are one column.
- Core's "Include file name as title" `h1` (an unclassed direct child of the root) is hidden when a card printed.
