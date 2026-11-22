# File explorer icons: manual checks

Open `test/vault` in Obsidian with the plugin enabled; Settings → Saga → File explorer → Render file icons? on, Icon look Renderer.

- **Icons.** Every folder shows a closed folder icon in place of its arrow. Icons are vertically centred on their names. Ada Lovelace and Bob show the character icon, Waterdeep the location icon, Harbor Guild the faction icon, Moonblade the item icon and the maps the map icon, in the renderer colours. Links, Lists and Type Unknown show the document icon. `coast.jpg` and `portrait.png` show none.
- **Untyped toggle.** Render icons for untyped files? is greyed out while Render file icons? is off. With it on, turn it off: Links, Lists and Type Unknown lose their icons; on again, they return.
- **Toggle.** Turn Render file icons? off: icons disappear without reopening the explorer, and Icon look hides unless Render icons with wikilinks? is on; on again, they return.
- **Map look.** Set Icon look to The Shattered Coast: Harbor Master shows a sea-coloured anchor, Ada (no pins) the Character icon; folders keep the folder icon.
- **Folder expand.** Collapse and expand `Places` and `Places/Docks`: expanded, the icon is the open folder; collapsed, the closed folder; one each, no arrow.
- **Type change.** Change `Items/Moonblade.md`'s `type` to `location`: its icon becomes the location icon; to a type with no renderer, the document icon.
- **Create, rename, move.** Create `Notes/New.md` with `type: faction`: it gets the faction icon. Rename it and move it to `Characters`: the icon stays.
- **Remap.** In Settings, add `note` to Faction's types and give `Notes/Lists.md` `type: note`: Lists gets the faction icon.
- **Disable the plugin.** All icons go.

## Mobile (iPhone, iPad)

1. On iPhone and iPad, the file explorer (left drawer) shows the folder, note and untyped-file icons.
