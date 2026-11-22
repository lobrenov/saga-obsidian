# Saga for Obsidian

An Obsidian plugin (id `saga`, desktop, Obsidian 1.10.2+) for world-building: a **Saga map** Bases view that draws the base's notes' `map-pins` on a map note's image, a **note header** that replaces the inline title and properties of notes whose `type` maps to a renderer, and optional renderer icons on wikilinks. Plans are in `docs/plans/`.

## Scripts
- `npm run dev` esbuild watch; writes `main.js`, `styles.css`, `manifest.json` into `test/vault/.obsidian/plugins/saga/`
- `npm run build` minified build, same outputs plus the repo root
- `npm run typecheck` `tsc -b` over the `shared`, `plugin`, `test` and `component` projects
- `npm run lint` ESLint (type-aware; `src/shared` may not import Obsidian, React or the DOM)
- `npm test` Vitest: `unit` (Node) and `component` (Chromium); `obsidian` is aliased to `test/fakes/obsidian.ts`; `component` first runs the production build and `bundle.test.tsx` loads `main.js` as Obsidian does

## Layout
- `src/main.ts` loads the config store and registers the map view, header and settings
- `src/shared` platform-free logic (frontmatter, wikilinks, pins, viewport maths, renderer definitions, config)
- `src/obsidian/vault.ts` the adapter: frontmatter reads, link resolution, text-preserving writes (`setField`, `updateField`, `updatePins`), the `.saga/renderers.yaml` config store (`docs/adapter.md`)
- `src/map` the Saga map Bases view (`docs/map.md`)
- `src/header` the note header (`docs/header.md`); every Obsidian DOM selector is in `src/header/dom.ts`
- `src/links` renderer icons on wikilinks in note text (`docs/links.md`)
- `src/settings` the renderer settings tab (`docs/settings.md`)
- `src/ui` Obsidian menus (`showMenu`) and `MenuSelect`, the dropdown button the map and header use in place of `<select>`
- `test/unit`, `test/component`, `test/fakes`; `test/vault` is the manual-check vault
- `docs/checks` manual checks in Obsidian per feature

## Conventions
- Dependencies are pinned exactly.
- Writes to notes go through the adapter (`vault.process`), changing only the edited key's text.
