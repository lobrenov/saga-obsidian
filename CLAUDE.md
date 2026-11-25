# Saga for Obsidian

An Obsidian plugin (id `saga`, desktop and mobile, Obsidian 1.10.2+) for world-building: a **Saga map** Bases view that draws the base's notes' `map-pins` on a map note's image, a **Saga calendar** Bases view that shows the base's notes dated on a calendar note as a calendar, feed or timeline, a **note header** that replaces the inline title and properties of notes (a Document card for notes whose `type` maps to no renderer), **banners** across the top of any note, optional icons and character titles on wikilinks, and optional file explorer icons. Plans are in `docs/plans/`.

## Scripts
- `npm run dev` esbuild watch; writes `main.js`, `styles.css`, `manifest.json` into `test/vault/.obsidian/plugins/saga/`
- `npm run build` minified build, same outputs plus the repo root
- `npm run typecheck` `tsc -b` over the `shared`, `plugin`, `test` and `component` projects
- `npm run lint` ESLint with `eslint-plugin-obsidianmd`'s recommended config, the rules of Obsidian's community plugin review (type-aware; `src/shared` may not import Obsidian, React or the DOM)
- `npm test` Vitest: `unit` (Node) and `component` (Chromium); `obsidian` is aliased to `test/fakes/obsidian.ts` and `test/fakes/dom.ts` adds Obsidian's DOM helpers (`createDiv`, `setCssStyles`, ...) for `component`; `component` first runs the production build and `bundle.test.tsx` loads `main.js` as Obsidian does

## Releases
Pushing a version tag (`git tag 0.10.7 && git push origin 0.10.7`) runs `.github/workflows/release.yml`: it builds, attests `main.js`, `styles.css` and `manifest.json` (GitHub artifact attestations) and uploads them to the tag's release, created as a draft when there is none; add notes and publish it on GitHub.

## Layout
- `src/main.ts` loads the config store and registers the map view, header and settings
- `src/shared` platform-free logic (frontmatter, wikilinks, pins, viewport maths, renderer definitions, config)
- `src/obsidian/vault.ts` the adapter: frontmatter reads, link resolution, text-preserving writes (`setField`, `setFields`, `updateField`, `updatePins`), the `.saga/renderers.yaml` config store (`docs/adapter.md`)
- `src/map` the Saga map Bases view (`docs/map.md`)
- `src/calendar` the Saga calendar Bases view and its Edit and Delete actions (`docs/calendar.md`); `src/shared/calendars` the calendar maths
- `src/header` the note header, including the Calendar and Lore layouts and the date editor (`docs/header.md`); every Obsidian DOM selector is in `src/header/dom.ts`
- `src/banner` note banners (`docs/banner.md`); every banner DOM selector is in `src/banner/dom.ts`
- `src/links` icons and character titles on wikilinks in note text (`docs/links.md`)
- `src/explorer` icons in the file explorer (`docs/explorer.md`); every explorer DOM selector is in `src/explorer/dom.ts`
- `src/print` the banner and header card in Export to PDF (`docs/print.md`); every print DOM selector is in `src/print/dom.ts`
- `src/settings` the renderer settings tab (`docs/settings.md`)
- `src/ui` Obsidian menus (`showMenu`), `MenuSelect`, the dropdown button the map, header and calendar view use in place of `<select>`, and `useHiddenLabel`, a name for `aria-labelledby` in place of an `aria-label` Obsidian would draw as a tooltip
- `test/unit`, `test/component`, `test/fakes`; `test/vault` is the manual-check vault
- `docs/checks` manual checks in Obsidian per feature

## Conventions
- Dependencies are pinned exactly.
- UI code is written against the React API; esbuild and Vitest alias `react` and `react-dom` to `preact/compat`, so the bundle holds Preact, not React.
- Writes to notes go through the adapter (`vault.process`), changing only the edited key's text.
