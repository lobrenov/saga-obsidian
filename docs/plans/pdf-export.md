# PDF export: build plan

Obsidian's **Export to PDF** prints a note's banner and its header card as they look on screen, read-only, sized to the export's page width.

## Approach

Core export renders the note into an off-screen `.print .markdown-preview-view` and runs the Markdown post-processors on it. It never sees the leaf's DOM, which is where the header and banner controllers draw. A post-processor that runs only inside the print root adds a static print block (banner, then card) as the root's first child, and resolves once its images have loaded.

Alternative: a separate **Saga: Export to PDF** command that renders the note itself and calls Electron's `printToPDF`. Pros: full-bleed banners, page size known. Cons: copies core's dialog, pagination and theming; much more code; relies on Electron APIs. Not planned.

## Export behaviour (spike, Obsidian 1.15.1)

- The print root is `.print > .markdown-preview-view.markdown-rendered`, in a hidden popout window with `theme-light` whatever the app theme. Rendering uses the root's own document and window (`el.doc`, `el.win`), not the globals.
- Core awaits a post-processor's promise before printing. Images (resource URLs) and backgrounds print.
- The print root holds no `.metadata-container` or `.inline-title`. "Include file name as title" adds an unclassed `h1` as the root's direct child, before `.mod-frontmatter`.
- The root is 1024 px wide while post-processors run and takes the page's content width at print time: A4 with default margins 500–649 px, A5 400–499 px. `@media print` and container queries apply at print time; widths measured in script do not.

## Assumptions

- The print block is read-only: no bar (badge, banner control, Type, Properties), no editors, no hover controls.
- Empty fields, and values that fail their schema, are left out. An empty portrait or emblem frame is left out too.
- A note prints a card exactly when its leaf would show one: renderers other than `document` always; `document` while the `documentCard` pref is on or the note has a banner (`docs/header.md`). Otherwise only the banner prints, and core's "Include file name as title" option decides the title.
- When Saga prints a card, core's file-name title (`:scope > h1` of the print root) is hidden, because the card shows the name.
- The banner spans the content box only (between the page margins).
- Desktop only: core has no PDF export on mobile.

## Design

- **Banner:** height from the content width, not px: `aspect-ratio: 3 / 1`, or `2 / 1` with `banner-tall`. `object-position` from `banner-y`. No scrim. Fade into the page background, as on screen.
- **Card:** the renderer's accent border and tint, starting where the banner's fade ends (no overlap: an image under the card's edge leaves a hairline in the PDF). `break-inside: avoid`.
- **Narrow pages** (print root under 500 px, e.g. A5): the portrait or emblem stacks above the name, and facts go to one column.
- **Fields:** label and value. Text as text; list as chips; link and links as chips with the linked note's renderer icon and name (no buttons); choice as text; image in its frame.

## Steps

Step 2 uses step 1's components.

### 1. Static print view
- `src/print/PrintField.tsx`: one read-only field per kind, as in Design. Returns null for empty or invalid values.
- `src/print/PrintNote.tsx`: banner (`bannerOf`, `resolveLink`, `resourceUrl`) and the card, under the same rule as the header controller (renderer, `documentCard` pref, banner). The card reuses the existing layouts, giving them a `field` that renders `PrintField` (the layouts already take `field` as a function, so they don't change).
- `src/header/registry.tsx`: `defineRendererView` also returns a `PrintLayout` with the read-only `field`.
- `Icon` needs `HeaderCtx`. Print supplies a `HeaderCtx` whose env has only `setIcon` and `app`; the other env members throw.
- **Agent:** `react-dev`.
- **Done:** component tests first: each renderer prints its fields; empty and invalid fields are absent; link chips show icon and name with no buttons; no focusable elements; banner `object-position` from `banner-y`; Document prints its card with the pref on or a banner, and banner only otherwise. `typecheck`, `lint`, `test` pass.

### 2. Post-processor and print CSS
- `src/print/index.ts`: `registerPrint(plugin, config, prefs)` registers a post-processor. It does nothing outside the print root (one `dom.ts` selector). It renders `PrintNote` into the root's document for `ctx.sourcePath`'s frontmatter and config with `flushSync` once per root, then resolves after the block's images load or fail. Called from `main.ts`.
- `src/print/print.css`: under the print root only: `container-type: inline-size`, the banner aspect ratios and fade, the narrow-page `@container` rules, `break-inside: avoid`, and hiding core's title while a card prints.
- `docs/print.md` (as built), a `CLAUDE.md` layout line, `docs/checks/print.md`. `test/vault` gains a real banner image (the attachments are 1×1) and a note with `banner`.
- **Agent:** `typescript-dev`.
- **Done:** component tests: the processor is a no-op outside `.print`; inside it, exactly one block is prepended per root; the promise resolves only after images load or error. Bundle test still loads. Manual checks pass: each renderer, and Document with the pref on and off, exported at A4, A5 and Letter, with and without banners, `banner-tall`, light and dark themes.

## Not covered
- Other PDF plugins that skip post-processors.
- Choosing the page size from Saga, and full-bleed banners (the alternative above).
