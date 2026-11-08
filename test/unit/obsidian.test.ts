import { describe, expect, it } from 'vitest'
import { FakeApp } from '../fakes/obsidian'
import { CONFIG_PATH, createConfigStore, frontmatterOf, resolveLink, resourceUrl, setField, updateField, updatePins } from '../../src/obsidian/vault'
import { parseFrontmatter } from '../../src/shared/frontmatter'

const BOM = '﻿'
const note = (eol: string): string =>
  [
    '# a comment kept',
    'type: Location',
    'map-pins:',
    '  - map: "[[Coast]]"',
    '    x: 1',
    '    y: 2',
    'tags: [a, b] # trailing comment',
    ''
  ].join(eol)
const file = (eol: string): string => `${BOM}---${eol}${note(eol)}---${eol}# Body${eol}`

const pin = { map: '[[Coast]]', x: 10.5, y: 20, style: 'camp' as const }

describe('frontmatterOf, resolveLink, resourceUrl', () => {
  it('reads cached frontmatter without its position', () => {
    const fake = new FakeApp()
    const f = fake.addFile('Places/Waterdeep.md', file('\n'))
    expect(frontmatterOf(fake.asApp(), f)).toEqual({ type: 'Location', 'map-pins': [{ map: '[[Coast]]', x: 1, y: 2 }], tags: ['a', 'b'] })
    expect(frontmatterOf(fake.asApp(), fake.addFile('Plain.md', '# no frontmatter'))).toEqual({})
  })

  it('resolves a WikiLink or a link string', () => {
    const fake = new FakeApp()
    const coast = fake.addFile('Maps/Coast.md')
    expect(resolveLink(fake.asApp(), '[[Coast|the coast]]', 'Places/Waterdeep.md')).toBe(coast)
    expect(resolveLink(fake.asApp(), { target: 'Maps/Coast', embed: false }, 'Places/Waterdeep.md')).toBe(coast)
    expect(resolveLink(fake.asApp(), '[[Nowhere]]', 'a.md')).toBeNull()
    expect(resolveLink(fake.asApp(), 'not a link', 'a.md')).toBeNull()
  })

  it('gives the resource URL of a file', () => {
    const fake = new FakeApp()
    expect(resourceUrl(fake.asApp(), fake.addFile('Attachments/coast.jpg'))).toBe(fake.vault.getResourcePath(fake.addFile('Attachments/coast.jpg')))
  })
})

describe.each([['\n'], ['\r\n']])('writes with %j line endings', (eol) => {
  it('updatePins changes only the map-pins value', async () => {
    const fake = new FakeApp()
    const f = fake.addFile('Waterdeep.md', file(eol))
    const result = await updatePins(fake.asApp(), f, () => ({ kind: 'add', pin }))
    expect(result.ok).toBe(true)
    const text = fake.text('Waterdeep.md')
    expect(text.startsWith(BOM)).toBe(true)
    expect(text).toContain(`# a comment kept${eol}`)
    expect(text).toContain(`tags: [a, b] # trailing comment${eol}`)
    expect(text.endsWith(`---${eol}# Body${eol}`)).toBe(true)
    expect(parseFrontmatter(text).data['map-pins']).toHaveLength(2)
    expect(text.replace(/map-pins:[\s\S]*?(?=tags:)/, '')).toBe(file(eol).replace(/map-pins:[\s\S]*?(?=tags:)/, ''))
  })

  it('setField changes only that key and undefined removes it', async () => {
    const fake = new FakeApp()
    const f = fake.addFile('Waterdeep.md', file(eol))
    expect((await setField(fake.asApp(), f, 'type', 'Settlement')).ok).toBe(true)
    expect(fake.text('Waterdeep.md')).toBe(file(eol).replace('type: Location', 'type: Settlement'))
    expect((await setField(fake.asApp(), f, 'type', undefined)).ok).toBe(true)
    expect(fake.text('Waterdeep.md')).toBe(file(eol).replace('type: Location\r\n', '').replace('type: Location\n', ''))
  })
})

describe('write failures', () => {
  it('returns the error and leaves the file untouched', async () => {
    const fake = new FakeApp()
    const broken = '---\nkey: [unclosed\n---\nbody\n'
    const f = fake.addFile('Bad.md', broken)
    const result = await setField(fake.asApp(), f, 'type', 'x')
    expect(result.ok).toBe(false)
    expect(fake.text('Bad.md')).toBe(broken)
    expect(fake.processed).toEqual([])

    const g = fake.addFile('Empty.md', '---\ntype: x\n---\n')
    const missing = await updatePins(fake.asApp(), g, () => ({ kind: 'remove', index: 0 }))
    expect(missing.ok).toBe(false)
    expect(fake.text('Empty.md')).toBe('---\ntype: x\n---\n')
  })
})

describe('config store', () => {
  it('uses the default config without a file', async () => {
    const fake = new FakeApp()
    const store = await createConfigStore(fake.asApp(), fake.owner())
    expect(store.state()).toMatchObject({ config: { typeKey: 'type', renderers: {} }, issues: [], text: null })
    expect(store.rendererOf({ type: 'Character' }).renderer).toBe('character')
    expect(store.rendererOf({ type: 'npc' }).renderer).toBe('document')
  })

  it('loads the file, reloads on change and notifies subscribers', async () => {
    const fake = new FakeApp()
    fake.setRaw(CONFIG_PATH, 'renderers:\n  character:\n    types: [npc]\n')
    const store = await createConfigStore(fake.asApp(), fake.owner())
    expect(store.rendererOf({ type: 'NPC' }).renderer).toBe('character')

    const seen: (string | null)[] = []
    const off = store.subscribe((state) => seen.push(state.text))
    fake.setRaw(CONFIG_PATH, 'renderers:\n  location:\n    types: [npc]\n')
    await store.reload()
    expect(store.rendererOf({ type: 'npc' }).renderer).toBe('location')
    expect(seen).toHaveLength(1)

    fake.deleteRaw(CONFIG_PATH)
    await store.reload()
    expect(store.state().text).toBeNull()
    expect(store.rendererOf({ type: 'npc' }).renderer).toBe('document')

    off()
    fake.setRaw(CONFIG_PATH, 'typeKey: kind\n')
    await store.reload()
    expect(seen).toHaveLength(2)
    expect(store.state().config.typeKey).toBe('kind')
  })

  it('reports invalid YAML and unknown renderers', async () => {
    const fake = new FakeApp()
    fake.setRaw(CONFIG_PATH, 'renderers: [unclosed')
    const store = await createConfigStore(fake.asApp(), fake.owner())
    expect(store.state().issues).toHaveLength(1)
    expect(store.state().config.typeKey).toBe('type')
    fake.setRaw(CONFIG_PATH, 'renderers:\n  dragon:\n    types: [x]\n')
    await store.reload()
    expect(store.state().issues[0]?.message).toContain('dragon')
  })

  it('writeConfig stores the text and reloads', async () => {
    const fake = new FakeApp()
    const store = await createConfigStore(fake.asApp(), fake.owner())
    await store.writeConfig('typeKey: kind\n')
    expect(fake.text(CONFIG_PATH)).toBe('typeKey: kind\n')
    expect(store.state().config.typeKey).toBe('kind')
  })

  it('stops watching when the owner unloads', async () => {
    const fake = new FakeApp()
    const owner = fake.owner()
    const store = await createConfigStore(fake.asApp(), owner)
    owner.unload()
    fake.setRaw(CONFIG_PATH, 'typeKey: kind\n')
    await Promise.resolve()
    expect(store.state().config.typeKey).toBe('type')
  })
})

describe('updateField', () => {
  it('builds each write from the value in the file at write time', async () => {
    const fake = new FakeApp()
    const f = fake.addFile('Places/Waterdeep.md', file('\n'))
    const add = (item: string) => (current: unknown) => [...(current as string[]), item]
    await Promise.all([updateField(fake.asApp(), f, 'tags', add('c')), updateField(fake.asApp(), f, 'tags', add('d'))])
    expect(parseFrontmatter(fake.text('Places/Waterdeep.md')).data.tags).toEqual(['a', 'b', 'c', 'd'])
    expect(fake.text('Places/Waterdeep.md')).toContain('# a comment kept')
  })

  it('saves an open editor of the note before writing', async () => {
    const fake = new FakeApp()
    const f = fake.addFile('Places/Waterdeep.md', file('\n'))
    const saved: string[] = []
    fake.workspace.getLeavesOfType = () => [{ view: { file: f, save: () => (saved.push(f.path), Promise.resolve()) } }]
    await updateField(fake.asApp(), f, 'type', () => 'Region')
    expect(saved).toEqual(['Places/Waterdeep.md'])
  })
})
