import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { createConfigStore, CONFIG_PATH } from '../../src/obsidian/vault'
import { configOf, draftIssues, draftOf, isDirty, rebase, saveText } from '../../src/settings/draft'
import { parseConfig } from '../../src/shared/schemas/config'
import { FakeApp } from '../fakes/obsidian'

const FILE = `# vault config
typeKey: category # what we match on
extra: keep-me
renderers:
  character:
    types: [character, pc]
    templates: [Templates/Character.md]
  location:
    types: [place] # places
  custom: { types: [x] }
`

async function setup(text: string | null = FILE) {
  const app = new FakeApp()
  if (text !== null) app.setRaw(CONFIG_PATH, text)
  const store = await createConfigStore(app.asApp(), app.owner())
  return { app, store }
}

describe('settings draft', () => {
  it('clearing the types of a renderer with default types restores all of them', async () => {
    const { store } = await setup(null)
    const draft = draftOf(store.state().config)
    expect(draft.types['lore']).toBe('Lore, Event')
    draft.types['lore'] = 'saga'
    expect(configOf(draft, store.state().config).renderers.lore?.types).toEqual(['saga'])
    draft.types['lore'] = ''
    expect(configOf(draft, store.state().config).renderers.lore?.types ?? []).toEqual([])
  })

  it('saves over the file text, keeping comments, unknown keys and templates, and round-trips through parseConfig', async () => {
    const { app, store } = await setup()
    const draft = draftOf(store.state().config)
    draft.types.character = 'character, pc, npc'
    draft.keys.character!.title = 'job'
    const result = saveText(store.state(), draft)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    await store.writeConfig(result.value)

    const text = app.text(CONFIG_PATH)
    expect(text).toContain('# vault config')
    expect(text).toContain('# what we match on')
    expect(text).toContain('# places')
    expect(text).toContain('extra: keep-me')
    expect(text.indexOf('typeKey')).toBeLessThan(text.indexOf('renderers'))
    const { config, issues } = parseConfig(parse(text))
    expect(issues).toMatchObject([{ path: 'renderers.custom' }])
    expect(config.typeKey).toBe('category')
    expect(config.renderers.character).toEqual({ types: ['character', 'pc', 'npc'], keys: { title: 'job' }, templates: ['Templates/Character.md'] })
  })

  it('keeps a renderer\'s pin defaults when the tab saves other edits', async () => {
    const { store } = await setup('renderers:\n  faction:\n    types: [faction]\n    pin: { shape: herald, color: indigo }\n')
    const draft = draftOf(store.state().config)
    draft.types.faction = 'faction, guild'
    expect(configOf(draft, store.state().config).renderers.faction?.pin).toEqual({ shape: 'herald', color: 'indigo' })
    const result = saveText(store.state(), draft)
    expect(result.ok && parse(result.value)).toMatchObject({ renderers: { faction: { types: ['faction', 'guild'], pin: { shape: 'herald', color: 'indigo' } } } })
  })

  it('leaves the file untouched when nothing was edited', async () => {
    const { store } = await setup()
    const result = saveText(store.state(), draftOf(store.state().config))
    expect(result).toEqual({ ok: true, value: FILE })
  })

  it('creates the file from nothing, writing only what differs from the defaults', async () => {
    const { app, store } = await setup(null)
    const draft = draftOf(store.state().config)
    draft.types.location = 'location, place'
    const result = saveText(store.state(), draft)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    await store.writeConfig(result.value)
    expect(parseConfig(parse(app.text(CONFIG_PATH))).config.renderers).toEqual({ location: { types: ['location', 'place'], keys: {}, templates: [] } })
  })

  it('refuses a type mapped twice, a key collision and an empty type key without writing', async () => {
    const { app, store } = await setup()
    const base = store.state().config
    const before = app.text(CONFIG_PATH)

    const twice = draftOf(base)
    twice.types.location = 'location, PC'
    const collision = draftOf(base)
    collision.keys.character!.title = 'location'
    const empty = draftOf(base)
    empty.typeKey = ' '

    for (const draft of [twice, collision, empty]) {
      const result = saveText(store.state(), draft)
      expect(result.ok).toBe(false)
      expect(!result.ok && result.error.kind === 'validation' && result.error.issues.length).toBeGreaterThan(0)
      expect(draftIssues(draft, base).length).toBeGreaterThan(0)
    }
    expect(app.text(CONFIG_PATH)).toBe(before)
  })

  it('refuses a change to an entry that could not be read', async () => {
    const { store } = await setup('renderers:\n  item: 3\n')
    const draft = draftOf(store.state().config)
    draft.types.item = 'item, loot'
    expect(saveText(store.state(), draft).ok).toBe(false)
  })

  it('refreshes the state the tab renders from after an external change', async () => {
    const { app, store } = await setup()
    const seen: string[] = []
    store.subscribe((state) => seen.push(draftOf(state.config).types.location ?? ''))
    app.setRaw(CONFIG_PATH, 'renderers:\n  location: { types: [place] }\n')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(seen).toEqual(['place'])
    expect(configOf(draftOf(store.state().config), store.state().config)).toEqual(store.state().config)
  })

  it('keeps edited inputs and takes the rest from an external change, and saves as a merge', async () => {
    const { app, store } = await setup()
    const previous = store.state().config
    const draft = draftOf(previous)
    expect(isDirty(draft, previous)).toBe(false)
    draft.keys.character!.title = 'job'
    expect(isDirty(draft, previous)).toBe(true)

    app.setRaw(CONFIG_PATH, FILE.replace('[place]', '[place, town]'))
    await store.reload()
    const next = store.state().config
    const merged = rebase(draft, previous, next)
    expect(merged.keys.character!.title).toBe('job')
    expect(merged.types.location).toBe('place, town')
    expect(isDirty(rebase(draftOf(previous), previous, next), next)).toBe(false)

    const result = saveText(store.state(), merged)
    expect(result.ok && parseConfig(parse(result.value)).config.renderers.location?.types).toEqual(['place', 'town'])
  })

  describe('hidden fields', () => {
    it('holds each optional field as shown or hidden, and saves only the hidden ones in field order', async () => {
      const { store } = await setup('renderers:\n  character:\n    types: [character]\n    hidden: [status]\n')
      const draft = draftOf(store.state().config)
      expect(draft.hidden.character).toEqual({ title: false, affiliation: false, location: false, status: true })
      expect(draft.hidden.map).toEqual({})
      draft.hidden.character!.title = true
      const result = saveText(store.state(), draft)
      expect(result.ok && result.value).toBe('renderers:\n  character:\n    types: [character]\n    hidden: [title, status]\n')
    })

    it('drops hidden once every field is shown again, and writes nothing for a draft left as read', async () => {
      const { store } = await setup('renderers:\n  faction:\n    hidden: [rivals]\n')
      expect(saveText(store.state(), draftOf(store.state().config))).toEqual({ ok: true, value: 'renderers:\n  faction:\n    hidden: [rivals]\n' })
      const draft = draftOf(store.state().config)
      draft.hidden.faction!.rivals = false
      const result = saveText(store.state(), draft)
      expect(result.ok && parse(result.value)).toEqual({ renderers: {} })
    })

    it('keeps a toggle the user changed and takes the rest from an external change', async () => {
      const { app, store } = await setup('renderers:\n  item:\n    hidden: [kind]\n')
      const previous = store.state().config
      const draft = draftOf(previous)
      draft.hidden.item!.rarity = true
      app.setRaw(CONFIG_PATH, 'renderers:\n  item:\n    hidden: [owner]\n')
      await store.reload()
      const merged = rebase(draft, previous, store.state().config)
      expect(merged.hidden.item).toEqual({ kind: false, rarity: true, owner: true, location: false })
    })
  })

  describe('pin defaults', () => {
    it('draws each renderer\'s built-in look, or its configured keys over it', async () => {
      const { store } = await setup('renderers:\n  faction:\n    pin: { shape: herald }\n')
      const draft = draftOf(store.state().config)
      expect(draft.pin.character).toEqual({ shape: 'pin', color: 'crimson', icon: 'user' })
      expect(draft.pin.faction).toEqual({ shape: 'herald', color: 'indigo', icon: 'flag' })
      expect(draft.pin.document).toEqual({ shape: 'pin', color: 'umber', icon: 'file-text' })
    })

    it('writes a changed key only, keeping comments, and drops a key set back to its default', async () => {
      const { app, store } = await setup('# cfg\nrenderers:\n  faction:\n    types: [faction] # fx\n    pin: { shape: herald, color: rust }\n')
      const draft = draftOf(store.state().config)
      draft.pin.faction = { shape: 'herald', color: 'indigo', icon: 'skull' }
      const result = saveText(store.state(), draft)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      await store.writeConfig(result.value)
      expect(app.text(CONFIG_PATH)).toContain('# fx')
      expect(parseConfig(parse(app.text(CONFIG_PATH))).config.renderers.faction?.pin).toEqual({ shape: 'herald', icon: 'skull' })
    })

    it('writes nothing for a value equal to the built-in default and removes an emptied pin', async () => {
      const { store } = await setup()
      const draft = draftOf(store.state().config)
      draft.pin.item = { shape: 'pin', color: 'ochre', icon: 'gem' }
      expect(saveText(store.state(), draft)).toEqual({ ok: true, value: FILE })
      draft.pin.item = { shape: 'circle', color: 'ochre', icon: 'gem' }
      const result = saveText(store.state(), draft)
      expect(result.ok && parseConfig(parse(result.value)).config.renderers.item?.pin).toEqual({ shape: 'circle' })
    })

    it('saves document\'s pin look', async () => {
      const { store } = await setup()
      const draft = draftOf(store.state().config)
      draft.pin.document = { shape: 'flag', color: 'umber', icon: 'file-text' }
      const result = saveText(store.state(), draft)
      expect(result.ok && parseConfig(parse(result.value)).config.renderers.document?.pin).toEqual({ shape: 'flag' })
    })

    it('rebases pin edits per key', async () => {
      const { app, store } = await setup('renderers:\n  faction: { types: [faction], pin: { color: rust } }\n')
      const previous = store.state().config
      const draft = draftOf(previous)
      draft.pin.faction = { ...draft.pin.faction!, icon: 'skull' }
      expect(isDirty(draft, previous)).toBe(true)
      app.setRaw(CONFIG_PATH, 'renderers:\n  faction: { types: [faction], pin: { color: plum, shape: flag } }\n')
      await store.reload()
      const merged = rebase(draft, previous, store.state().config)
      expect(merged.pin.faction).toEqual({ shape: 'flag', color: 'plum', icon: 'skull' })
    })
  })
})
