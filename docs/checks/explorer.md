# File explorer icons: manual checks

Open `test/vault` in Obsidian with the plugin enabled; Settings → Saga → File explorer → Render file icons? on, Icon look Renderer.

- **Icons.** Every folder shows a folder icon after its chevron. Ada Lovelace and Bob show the character icon, Waterdeep the location icon, Harbor Guild the faction icon, Moonblade the item icon and the maps the map icon, in the renderer colours. Links, Lists and Type Unknown show the document icon. `coast.jpg` and `portrait.png` show none.
- **Untyped toggle.** Render icons for untyped files? is greyed out while Render file icons? is off. With it on, turn it off: Links, Lists and Type Unknown lose their icons; on again, they return.
- **Toggle.** Turn Render file icons? off: icons disappear without reopening the explorer, and Icon look hides unless Render icons with wikilinks? is on; on again, they return.
- **Pin look.** Set Icon look to Pin: Harbor Master shows a sea-coloured anchor and Ada a crimson user icon; folders keep the folder icon.
- **Folder expand.** Collapse and expand `Places` and `Places/Docks`: their rows have icons, one each.
- **Type change.** Change `Items/Moonblade.md`'s `type` to `location`: its icon becomes the location icon; to a type with no renderer, the document icon.
- **Create, rename, move.** Create `Notes/New.md` with `type: faction`: it gets the faction icon. Rename it and move it to `Characters`: the icon stays.
- **Remap.** In Settings, add `note` to Faction's types and give `Notes/Lists.md` `type: note`: Lists gets the faction icon.
- **Disable the plugin.** All icons go.
