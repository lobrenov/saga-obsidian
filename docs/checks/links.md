# Link icons: manual checks

Open `test/vault` in Obsidian with the plugin enabled and `Notes/Links.md` open; Settings → Saga → Link icons on.

- **Live Preview.** Ada, the city, Harbor Guild, Moonblade and The Shattered Coast show their renderer icons in the renderer colours; Lists and Nowhere show none. The heading, callout and table links have icons; the code span and the embed do not. Moving the cursor into a link shows the icon before `[[`.
- **Reading view.** The same links show the same icons.
- **Source mode.** No icons.
- **Toggle.** Turn Link icons off: icons disappear in open Live Preview and Reading view tabs without reopening; on again, they return.
- **Type change.** Change `Items/Moonblade.md`'s `type` to `location`: its links switch to the location icon; to a type with no renderer, the icon goes.
- **Create and delete.** Create `Nowhere.md` with `type: character`: the Nowhere link gets the character icon. Delete it: the icon goes.
- **Remap.** In Settings, add `note` to Faction's types and give `Notes/Lists.md` `type: note`: the Lists link gets the faction icon.
