# Settings: manual checks

Open `test/vault` in Obsidian with the plugin enabled; Settings → Saga.

- **Remap a type.** Add `npc` to Character's types and pause. An open note with `type: npc` re-renders with the Character header without reopening; remove `npc`, it falls back to Document.
- **External edit.** With the tab open and no unsaved input, edit `.saga/renderers.yaml` in an editor (change a type list). The tab re-renders with the new values.
- **External edit while editing.** Change Character's types in the tab and, within half a second, change Location's types in the file. The tab shows "renderers.yaml changed on disk…", keeps the Character input and shows the new Location types; the next save writes both.
- **Write failure.** Make `.saga/renderers.yaml` read-only (`chmod 444`) and edit a type: a Notice and the issues area show "Could not write renderers.yaml: …"; restore with `chmod 644`.
- **Comments survive.** Put comments, an extra top-level key and a `templates` list in `.saga/renderers.yaml`, change a type or a field key in the tab. Only the edited value changes (diff in git); comments, the extra key, `templates` and key order remain.
- **Field rename.** Set Character's Title key to `epithet`; a note with `epithet:` shows it as the title in its header. Clear the input; the key returns to the default and the `keys` entry is removed.
- **Hide a field.** Open Character, turn Title's toggle off: its key input disables; after the pause `.saga/renderers.yaml` has `hidden: [title]` under `character` and an open Ada Lovelace header drops the epithet though `title:` is set. Turn off Affiliation, Location and Status too: the facts and their rule disappear. Turn them all back on: `hidden` leaves the file. Portrait, Image and Emblem rows have no toggle.
- **Hidden in the file.** Put `hidden: [portrait, nope]` under `character`: both show as issues and nothing is hidden.
- **Refusal.** Map a type that another renderer holds, or give two fields the same key: the issue shows inline, nothing is written and the file is unchanged.
- **Unreadable entry.** Make a renderer's entry unreadable in the file (`item: 3`): its inputs are disabled and the issue shows inline.
- **Focus while typing.** Type a long types list slowly: saves happen between pauses and the cursor stays in the input.
- **Sections.** Settings → Saga reads Maps, Icons (Icon look, shown whatever the toggles), File rendering, File explorer, Renderers, Pin defaults.
- **Renderer cards.** Each renderer is a card with its name, its types beneath and a chevron on the right; clicking it opens the card (chevron points down) to Types and one row per field, inside the same card. Document is the last card, without a chevron. Edit a type: the card's types line follows; the card stays open after a save.
- **Pin row alignment.** Set Faction's Shape to Herald: on every row the preview, Shape, Colour, Icon and Reset start at the same x, and the renderer name is centred with them. Narrow the settings window: the name moves above the controls, which stay on one line.
- **Pin defaults rows.** Settings → Saga → Pin defaults shows one row per renderer (Character to Document) with a pin preview, Shape and Colour dropdowns, an Icon button and, only when the look differs from the built-in default, Reset. The preview shows the built-in look first (e.g. Character: crimson pin, user icon) and the icon reads light on light themes and dark on dark themes.
- **Pin default change.** With a map open, set Faction's Shape to Herald, Colour to Violet and pick another icon. The preview updates at once; after the pause `.saga/renderers.yaml` has `pin: { shape: herald, color: violet, icon: … }` under `faction` and the open map redraws Faction pins without reload.
- **Default not written.** Set a Colour back to the renderer's built-in (e.g. Faction Indigo): that key leaves `pin`; when all three match, the `pin` entry is removed. Reset does the same for all three and hides itself.
- **Pin defaults survive.** Edit a type list on a renderer that has `pin` in the file: `pin` is unchanged. Edit `pin` in the file with the tab open and no unsaved input: the row follows. Change an icon in the tab and the same renderer's colour in the file within half a second: both are kept.

## Mobile (iPhone, iPad)

1. On iPhone and iPad, Settings → Saga opens; a change saves to `.saga/renderers.yaml` and an open note or map follows it.
