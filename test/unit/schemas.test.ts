import { describe, expect, it } from 'vitest'
import { noteFilePathSchema, notePath, notePathSchema, noteIdSchema } from '../../src/shared/ids'
import { defineRenderer } from '../../src/shared/renderers/define'
import { character, map } from '../../src/shared/renderers/definitions'
import { err, ok } from '../../src/shared/result'
import { parseConfig } from '../../src/shared/schemas/config'
import { readFrontmatter } from '../../src/shared/schemas/frontmatter'
import { parseMapPin, parseMapPins, PIN_STYLES } from '../../src/shared/schemas/pins'
import { parseWikiLink } from '../../src/shared/wikilink'

describe('NotePath', () => {
  it('accepts vault-relative paths', () => {
    expect(notePath('Characters/Ada.md')).toBe('Characters/Ada.md')
  })
  it.each(['/abs.md', '../x.md', 'a/../b.md', 'a//b.md', './a.md', 'a\\b.md', '', 'a/'])('rejects %j', (path) => {
    expect(notePathSchema.safeParse(path).success).toBe(false)
  })
  it('NoteId rejects empty', () => {
    expect(noteIdSchema.safeParse('').success).toBe(false)
  })
})

describe('NoteFilePath', () => {
  it('accepts markdown notes', () => {
    expect(noteFilePathSchema.safeParse('Characters/Ada.md').success).toBe(true)
  })
  it.each(['.saga/renderers.yaml', '.obsidian/app.json', 'a/.hidden.md', 'Notes/.tmp.md', 'a.png', 'a', '../a.md', '/a.md'])(
    'rejects %j',
    (path) => {
      expect(noteFilePathSchema.safeParse(path).success).toBe(false)
    }
  )
})

describe('Result helpers', () => {
  it('builds ok and err', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 })
    expect(err({ kind: 'io', message: 'x' })).toEqual({ ok: false, error: { kind: 'io', message: 'x' } })
  })
})

describe('parseWikiLink', () => {
  it('parses heading, block, alias and embed', () => {
    expect(parseWikiLink('[[Ada#Early life|the hero]]')).toEqual({ target: 'Ada', heading: 'Early life', alias: 'the hero', embed: false })
    expect(parseWikiLink('![[map.png#^b1]]')).toEqual({ target: 'map.png', block: 'b1', embed: true })
  })
  it('rejects non-links', () => {
    expect(parseWikiLink('Ada')).toBeNull()
    expect(parseWikiLink('[[]]')).toBeNull()
  })
})

describe('map pins', () => {
  it('lists the styles', () => {
    expect(PIN_STYLES).toEqual(['auto', 'rumour', 'danger', 'treasure', 'quest', 'camp'])
  })
  it('keeps a valid pin', () => {
    expect(parseMapPin({ map: '[[Coast]]', x: 1, y: 2, style: 'quest' })).toEqual({ value: { map: '[[Coast]]', x: 1, y: 2, style: 'quest' }, issues: [] })
  })
  it('keeps a valid shape, colour and icon', () => {
    const pin = { map: '[[Coast]]', x: 1, y: 2, shape: 'herald', color: 'rust', icon: 'skull' }
    expect(parseMapPin(pin)).toEqual({ value: pin, issues: [] })
  })
  it('drops an unknown shape, colour or icon, each with an issue, so the renderer\'s value applies', () => {
    const result = parseMapPin({ map: '[[Coast]]', x: 1, y: 2, shape: 'star', color: 'pink', icon: 'not-an-icon', style: 'quest' })
    expect(result.value).toEqual({ map: '[[Coast]]', x: 1, y: 2, style: 'quest' })
    expect(result.issues).toEqual([
      { path: 'shape', message: 'Unknown pin shape "star"; using the default' },
      { path: 'color', message: 'Unknown pin colour "pink"; using the default' },
      { path: 'icon', message: 'Unknown pin icon "not-an-icon"; using the default' }
    ])
  })
  it('falls back to auto for an unknown style, with an issue', () => {
    const result = parseMapPin({ map: '[[Coast]]', x: 1, y: 2, style: 'pirate' })
    expect(result.value).toEqual({ map: '[[Coast]]', x: 1, y: 2, style: 'auto' })
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]?.path).toBe('style')
  })
  it('rejects non-finite coordinates and non-wikilink maps', () => {
    expect(parseMapPin({ map: '[[Coast]]', x: Infinity, y: 2 }).value).toBeUndefined()
    expect(parseMapPin({ map: 'Coast', x: 1, y: 2 }).issues[0]?.path).toBe('map')
  })
  it('keeps invalid entries and extra keys so one entry can be edited alone', () => {
    const good = { map: '[[A]]', x: 0, y: 0, note: 'extra', style: 'camp' }
    const bad = { map: '[[A]]', x: 'a', y: 0, colour: 'red' }
    const odd = 'not an object'
    const { entries, pins, issues } = parseMapPins([good, bad, odd])
    expect(entries.map((e) => e.index)).toEqual([0, 1, 2])
    expect(entries.map((e) => e.raw)).toEqual([good, bad, odd])
    expect(entries.map((e) => e.pin !== undefined)).toEqual([true, false, false])
    expect(pins).toHaveLength(1)
    expect(issues[0]?.path).toBe('1.x')
  })
  it('reports a non-list value', () => {
    expect(parseMapPins({}).issues).toHaveLength(1)
  })
})

describe('config', () => {
  it('defaults when empty', () => {
    expect(parseConfig(null)).toEqual({ config: { typeKey: 'type', renderers: {} }, issues: [], invalid: [] })
  })
  it('reports unknown renderers and fields without failing', () => {
    const { config, issues } = parseConfig({
      typeKey: 'kind',
      renderers: {
        character: { types: ['NPC'], keys: { title: 'job', mood: 'mood' }, templates: ['T/C.md'] },
        monster: { types: ['monster'] }
      }
    })
    expect(config.typeKey).toBe('kind')
    expect(config.renderers).toEqual({ character: { types: ['NPC'], keys: { title: 'job' }, templates: ['T/C.md'] } })
    expect(issues.map((i) => i.path)).toEqual(['renderers.character.keys.mood', 'renderers.monster'])
  })
  it('reports a type mapped to two renderers, case-insensitively', () => {
    const { issues } = parseConfig({ renderers: { character: { types: ['NPC'] }, faction: { types: ['npc'] } } })
    expect(issues.map((i) => i.path)).toEqual(['renderers.faction.types'])
  })
  it('reports two fields sharing a note key', () => {
    const { issues } = parseConfig({ renderers: { character: { keys: { title: 'portrait' } } } })
    expect(issues.map((i) => i.path)).toEqual(['renderers.character.keys.title'])
  })
  it('rejects template paths that are not note paths', () => {
    expect(parseConfig({ renderers: { character: { templates: ['../x.md'] } } }).issues).toHaveLength(1)
  })
  it('reports malformed entries', () => {
    const { config, issues } = parseConfig({ renderers: { location: { types: 'nope' } } })
    expect(config.renderers).toEqual({})
    expect(issues[0]?.path).toBe('renderers.location.types')
  })
})

describe('readFrontmatter layers', () => {
  it('keeps raw and validates each field with key renames', () => {
    const layers = readFrontmatter(character, { portrait: '[[a.png]]', job: 'Smith', location: 42, extra: true }, { title: 'job' })
    expect(layers.raw).toEqual({ portrait: '[[a.png]]', job: 'Smith', location: 42, extra: true })
    expect(layers.fields.title).toEqual({ value: 'Smith', issues: [] })
    expect(layers.fields.portrait.value).toEqual({ target: 'a.png', embed: false })
    expect(layers.fields.location.value).toBeUndefined()
    expect(layers.fields.location.issues).toHaveLength(1)
  })
  it('reads a missing field as empty, without issues', () => {
    expect(readFrontmatter(map, {}).fields.image).toEqual({ value: undefined, issues: [] })
  })
  it('validates choice options', () => {
    const r = defineRenderer({
      id: 'item', label: '', icon: '', color: '',
      fields: { rarity: { kind: 'choice', key: 'rarity', label: 'R', options: ['common', 'rare'] } }
    })
    expect(readFrontmatter(r, { rarity: 'rare' }).fields.rarity.value).toBe('rare')
    expect(readFrontmatter(r, { rarity: 'epic' }).fields.rarity.issues).toHaveLength(1)
  })
})
