# Adapter (as built)

`src/obsidian/vault.ts` is the only module that reads or writes notes and the config for the map, header and settings.

## Reads
- `frontmatterOf(app, file)`: the metadata cache's frontmatter without `position`; `{}` when there is none.
- `resolveLink(app, link, fromPath)`: a `WikiLink` or `[[…]]` string through `metadataCache.getFirstLinkpathDest`.
- `resourceUrl(app, file)`: `vault.getResourcePath`.

## Writes
All writes run in `vault.process` through the text-preserving edits (`setFrontmatterKey`, `applyPinOpToText`), so only the edited key's value text changes; BOM, line endings, comments and key order survive. Open Markdown views of the note are saved first. A refused edit (invalid frontmatter, missing entry) leaves the file unchanged and returns an error `Result`.
- `setField(app, file, key, value)`: sets a key; `undefined` removes it.
- `updateField(app, file, key, update)`: sets a key to `update(current)`, with `current` read from the file at write time (list adds and removes).
- `updatePins(app, file, build)`: `build` receives the raw `map-pins` list at write time and returns the `PinOp` (locating the entry) or null when the pin is gone (`not-found`).

## Config
`createConfigStore(app, owner)` loads `.saga/renderers.yaml` (absent: the default config; invalid YAML: the default plus an issue) and reloads it on the vault's `raw` event for that path, since dot-folders are not indexed. Reloads apply in order (a slower earlier read is dropped). `state()` is `{ config, issues, invalid, text }`; `rendererOf(frontmatter)` resolves a note's renderer; `pinLookOf(renderer)` is the renderer's `pin` over the built-in pin defaults; `subscribe` listeners run after each load that changed the text, each isolated from the others' errors; `writeConfig(text)` creates `.saga/` when needed, writes and reloads.
