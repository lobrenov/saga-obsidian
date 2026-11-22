# Link icons and titles: manual checks

Open `test/vault` in Obsidian with the plugin enabled and `Notes/Links.md` open; Settings → Saga → Markdown rendering → Render icons with wikilinks? on, Icon look Renderer.

- **Live Preview.** Ada, the city, Harbor Guild, Moonblade, The Shattered Coast and Harbor Master show their renderer icons in the renderer colours; Lists and Nowhere show none. The heading, callout and table links have icons; the code span and the embed do not. Moving the cursor into a link shows the icon before `[[`.
- **Reading view.** The same links show the same icons.
- **Source mode.** No icons.
- **Toggle.** Turn Render icons with wikilinks? off: Icon look hides, and icons disappear in open Live Preview and Reading view tabs without reopening; on again, they return.
- **Type change.** Change `Items/Moonblade.md`'s `type` to `location`: its links switch to the location icon; to a type with no renderer, the icon goes.
- **Create and delete.** Create `Nowhere.md` with `type: character`: the Nowhere link gets the character icon. Delete it: the icon goes.
- **Remap.** In Settings, add `note` to Faction's types and give `Notes/Lists.md` `type: note`: the Lists link gets the faction icon.
- **Map look.** Icon look lists Renderer, Empty Map and The Shattered Coast. Set it to The Shattered Coast: Harbor Master shows a sea-coloured anchor, Moonblade the coins icon and the city the message-circle icon (their legacy styles) in the Item and Location pin colours; Ada (no pins) keeps the Character icon and colour. Set it to Empty Map: every link shows its renderer icon. Back to Renderer: the renderer icons return.
- **Map rename.** With Icon look The Shattered Coast, rename the map, then move its folder: the icons stay and Settings still shows the map selected. Delete a map selected in Icon look: icons fall back to the renderer's and the dropdown shows Renderer.
- **Titles.** Turn Render character titles with wikilinks? on: Ada reads "Ada Lovelace, Mathematician" and the heading's Bob "Bob, Fixer", in Live Preview and Reading view; the code span and embed do not. Clear Bob's `title`: the title goes. Off: the titles go, without reopening.
