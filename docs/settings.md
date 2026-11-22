# Settings (as built)

Settings → Saga edits `.saga/renderers.yaml` through the config store (`docs/adapter.md`).

## Modules
- `settings/draft.ts` (no Obsidian imports): `Draft` holds the inputs (type key; per renderer in `EDITABLE_IDS` a comma-separated types string and a key per field, blank for the default; per renderer including `document` its pin look as drawn, the built-in defaults under the configured `pin`). `draftOf(config)`, `configOf(draft, base)` (unedited entries and `document` stay as `base` has them), `draftIssues`, `saveText(state, draft)` (`buildConfigText` over the file as read; refused with the issues for an invalid config), `isDirty(draft, base)`, `rebase(draft, previous, next)` (edited inputs keep their value, the rest take `next`'s).
- `settings/index.ts`: `registerSettings(plugin, config, prefs)` adds the `PluginSettingTab`, built with `Setting`.
- `settings/pinPreview.ts`: `drawPinPreview`, the pin defaults row's preview, drawn as the map draws a pin (`map/pinStyles.ts`).

## Behaviour
- Rows: Maps (Pin labels: Always or On hover, in the plugin's `data.json`); Markdown rendering (Render icons with wikilinks?, Icon look shown while it or Render file icons? is on, Render character titles with wikilinks?; in `data.json`, `docs/links.md`); File explorer (Render file icons?, Render icons for untyped files? disabled while it is off; in `data.json`, `docs/explorer.md`); Pin defaults: one row per renderer with a pin preview, Shape and Colour dropdowns, an Icon button (`IconPicker`) and Reset while it differs from the built-in look, saved as the renderer's `pin` with only the keys that differ; Renderers: type key, then one collapsible section per renderer (summary: its types; expanded sections stay open across re-renders) with Types and one key input per field (the default key as placeholder); Document is a last, non-collapsible row as the fallback. Rules separate the sections only. An unreadable renderer entry shows its issue and disables its inputs.
- Issues of the saved config show inline and update as the draft changes.
- Edits save on their own 600 ms after the last change (and when the tab closes): `saveText`'s text through `writeConfig`; a refused config shows its issues and writes nothing; a write error shows in the issues area and as a Notice. `applyConfigToYaml` keeps comments, unknown keys, `templates` and key order; an edited value is replaced with its inline comment.
- The tab subscribes while shown. The tab's own save leaves the inputs (and focus) as they are. Another config change rebases the draft; with unsaved edits it shows "renderers.yaml changed on disk; your edits are kept and saved over the new text."
