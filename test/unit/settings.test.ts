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
  it('saves over the file text, keeping comments, unknown keys and templates, and round-trips through parseConfig', async () => {
    const { app, store } = await setup()
    const draft = draftOf(store.state().config)
    draft.types.character = 'character, pc, npc'
    draft.keys.character!.role = 'job'
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
    expect(config.renderers.character).toEqual({ types: ['character', 'pc', 'npc'], keys: { role: 'job' }, templates: ['Templates/Character.md'] })
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
    collision.keys.character!.role = 'title'
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
    draft.keys.character!.role = 'job'
    expect(isDirty(draft, previous)).toBe(true)

    app.setRaw(CONFIG_PATH, FILE.replace('[place]', '[place, town]'))
    await store.reload()
    const next = store.state().config
    const merged = rebase(draft, previous, next)
    expect(merged.keys.character!.role).toBe('job')
    expect(merged.types.location).toBe('place, town')
    expect(isDirty(rebase(draftOf(previous), previous, next), next)).toBe(false)

    const result = saveText(store.state(), merged)
    expect(result.ok && parseConfig(parse(result.value)).config.renderers.location?.types).toEqual(['place', 'town'])
  })
})
