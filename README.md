# Saga for Obsidian

Saga's world-building views inside Obsidian.

- **Saga map**: a Bases view. Pick a map note (`type: map` with an `image`); the base's notes that have `map-pins` on that map show as pins. Add, drag, restyle and remove pins; each change edits only the note's `map-pins`.
- **Note header**: notes whose `type` maps to a renderer (Character, Location, Faction, Item, Map) get a header with a banner or portrait, the title and editable fields in place of the inline title and properties. The editor stays below. The Properties toggle shows the native properties.

Renderer settings (type key, types per renderer, field key renames) are in Settings → Saga and are stored in `.saga/renderers.yaml`, shared with the Saga app.

## Install

Requires Obsidian 1.10.2 or later, desktop.

With BRAT: Add beta plugin, `lobrenov/saga-obsidian` (private: add a GitHub token with read access to its contents in BRAT). Or build it:

```bash
npm install
```

```bash
npm run build
```

Copy `main.js`, `styles.css` and `manifest.json` to `<vault>/.obsidian/plugins/saga/` and enable Saga in Community plugins. `test/vault` is set up for this already after a build.

## Pins

```yaml
map-pins:
  - map: "[[The Shattered Coast]]"
    x: 412.5
    y: 288
    style: camp   # optional: rumour, danger, treasure, quest, camp
```

`x` and `y` are image pixels from the top left.
