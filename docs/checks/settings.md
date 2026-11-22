# Settings: manual checks

Open `test/vault` in Obsidian with the plugin enabled; Settings → Saga.

- **Remap a type.** Add `npc` to Character's types and pause. An open note with `type: npc` re-renders with the Character header without reopening; remove `npc`, it falls back to Document.
- **External edit.** With the tab open and no unsaved input, edit `.saga/renderers.yaml` in an editor (change a type list). The tab re-renders with the new values.
- **External edit while editing.** Change Character's types in the tab and, within half a second, change Location's types in the file. The tab shows "renderers.yaml changed on disk…", keeps the Character input and shows the new Location types; the next save writes both.
- **Write failure.** Make `.saga/renderers.yaml` read-only (`chmod 444`) and edit a type: a Notice and the issues area show "Could not write renderers.yaml: …"; restore with `chmod 644`.
- **Comments survive.** Put comments, an extra top-level key and a `templates` list in `.saga/renderers.yaml`, change a type or a field key in the tab. Only the edited value changes (diff in git); comments, the extra key, `templates` and key order remain.
- **Field rename.** Set Character's Title key to `epithet`; a note with `epithet:` shows it as the title in its header. Clear the input; the key returns to the default and the `keys` entry is removed.
- **Refusal.** Map a type that another renderer holds, or give two fields the same key: the issue shows inline, nothing is written and the file is unchanged.
- **Unreadable entry.** Make a renderer's entry unreadable in the file (`item: 3`): its inputs are disabled and the issue shows inline.
- **Focus while typing.** Type a long types list slowly: saves happen between pauses and the cursor stays in the input.
