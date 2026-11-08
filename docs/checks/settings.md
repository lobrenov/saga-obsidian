# Settings: manual checks

Open `test/vault` in Obsidian with the plugin enabled; Settings → Saga.

- **Remap a type.** Add `npc` to Character's types and Save. An open note with `type: npc` re-renders with the Character header without reopening; remove `npc` and Save, it falls back to Document.
- **External edit.** With the tab open and no unsaved input, edit `.saga/renderers.yaml` in an editor (change a type list). The tab re-renders with the new values.
- **External edit while editing.** Change Character's types in the tab without saving, then change Location's types in the file. The tab shows "renderers.yaml changed on disk…", keeps the Character input and shows the new Location types; Save writes both.
- **Write failure.** Make `.saga/renderers.yaml` read-only (`chmod 444`) and Save: a Notice and the issues area show "Could not write renderers.yaml: …"; restore with `chmod 644`.
- **Comments survive.** Put comments, an extra top-level key and a `templates` list in `.saga/renderers.yaml`, change a type or a field key in the tab and Save. Only the edited value changes (diff in git); comments, the extra key, `templates` and key order remain.
- **Field rename.** Set Character's Role key to `job` and Save; a note with `job:` shows Role in its header. Clear the input and Save; the key returns to the default and the `keys` entry is removed.
- **Refusal.** Map a type that another renderer holds, or give two fields the same key: the issue shows inline, Save writes nothing and the file is unchanged.
- **Unreadable entry.** Make a renderer's entry unreadable in the file (`item: 3`): its inputs are disabled and the issue shows inline.
- **Shared file.** The same `.saga/renderers.yaml` opens in the Saga app with the same mappings.
