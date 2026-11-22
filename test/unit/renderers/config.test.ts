import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'
import { parseConfig, type Config } from '../../../src/shared/schemas/config'
import { applyConfigToYaml } from '../../../src/shared/schemas/configYaml'

const apply = (existing: string | null, config: Config): string => {
  const result = applyConfigToYaml(existing, config)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
const config = (renderers: Config['renderers'], typeKey = 'type'): Config => ({ typeKey, renderers })
const entry = (over: Partial<NonNullable<Config['renderers']['character']>> = {}) => ({ types: [], keys: {}, templates: [], ...over })

describe('applyConfigToYaml', () => {
  it('creates the file content from nothing, flow style, without default keys', () => {
    const text = apply(null, config({ character: entry({ types: ['character', 'NPC'], keys: { title: 'title', portrait: 'avatar' } }) }))
    expect(text).toBe('renderers:\n  character:\n    types: [character, NPC]\n    keys: {portrait: avatar}\n')
    expect(parseConfig(parse(text)).config.renderers.character).toEqual({ types: ['character', 'NPC'], keys: { portrait: 'avatar' }, templates: [] })
  })

  it('writes nothing for a renderer with nothing to say and keeps an untouched file byte-identical', () => {
    expect(apply(null, config({ location: entry() }))).toBe('{}\n')
    const original = '# my renderers\ntypeKey: type\nrenderers:\n  character:\n    types: [character, NPC] # who counts\n    keys: { portrait: avatar }\n'
    const parsed = parseConfig(parse(original)).config
    expect(apply(original, parsed)).toBe(original)
  })

  it('keeps unknown top-level keys, unknown renderers, comments and key order when values change', () => {
    const original = [
      '# Saga renderers',
      'typeKey: type',
      'theme: parchment # unknown, kept',
      'renderers:',
      '  character:',
      '    # who is a character',
      '    types: [character, NPC]',
      '    keys: { portrait: avatar }',
      '    templates: [Templates/Character.md]',
      '  monster:',
      '    types: [beast]',
      ''
    ].join('\n')
    const parsed = parseConfig(parse(original)).config
    const next = config({ ...parsed.renderers, character: { ...entry(), ...parsed.renderers.character!, types: ['character', 'NPC', 'adversary'], keys: { portrait: 'avatar', title: 'job' } } })
    const text = apply(original, next)
    expect(text).toContain('# Saga renderers')
    expect(text).toContain('theme: parchment # unknown, kept')
    expect(text).toContain('# who is a character')
    expect(text).toContain('monster:\n    types: [beast]')
    expect(text.indexOf('theme')).toBeLessThan(text.indexOf('renderers:'))
    expect(parse(text)).toMatchObject({
      theme: 'parchment',
      renderers: { character: { types: ['character', 'NPC', 'adversary'], keys: { portrait: 'avatar', title: 'job' }, templates: ['Templates/Character.md'] }, monster: { types: ['beast'] } }
    })
  })

  it('removes a key that is renamed back to its default and drops an empty keys map', () => {
    const original = 'renderers:\n  character:\n    types: [character]\n    keys: { title: job }\n'
    const text = apply(original, config({ character: entry({ types: ['character'], keys: {} }) }))
    expect(parse(text)).toEqual({ renderers: { character: { types: ['character'] } } })
  })

  it('changes the type key', () => {
    expect(parse(apply('typeKey: type\n', config({}, 'kind')))).toEqual({ typeKey: 'kind' })
    expect(apply(null, config({}))).toBe('{}\n')
  })

  it('refuses YAML it cannot parse and non-mapping documents', () => {
    expect(applyConfigToYaml('renderers: [', config({}))).toMatchObject({ ok: false, error: { kind: 'parse' } })
    expect(applyConfigToYaml('- a\n- b\n', config({}))).toMatchObject({ ok: false, error: { kind: 'parse' } })
  })
})

type YamlConfig = { renderers: Record<string, Record<string, unknown>> }

describe('pin defaults in the config', () => {
  const original = [
    '# Saga renderers',
    'renderers:',
    '  faction:',
    '    # who they are',
    '    types: [faction] # kept',
    '    pin: { color: indigo, note: kept }',
    '    extra: 1',
    '  location:',
    '    types: [location]',
    ''
  ].join('\n')

  it('reads pin values and reports unknown ones as issues, dropping them', () => {
    const read = parseConfig(parse('renderers:\n  faction:\n    pin: { shape: herald, color: pink, icon: nope }\n  item:\n    pin: oops\n'))
    expect(read.config.renderers.faction?.pin).toEqual({ shape: 'herald' })
    expect(read.config.renderers.item?.pin).toBeUndefined()
    expect(read.issues.map((issue) => issue.path)).toEqual(['renderers.faction.pin.color', 'renderers.faction.pin.icon', 'renderers.item.pin'])
    expect(read.invalid).toEqual([])
  })

  it('writes a changed pin key, keeping comments, unknown keys and order', () => {
    const base = parseConfig(parse(original)).config
    const edited = config({ ...base.renderers, faction: { ...base.renderers.faction!, pin: { color: 'sea', icon: 'flag' } } })
    const text = apply(original, edited)
    expect(text).toContain('# who they are')
    expect(text).toContain('types: [faction] # kept')
    expect(text).toContain('extra: 1')
    expect(text.indexOf('types:')).toBeLessThan(text.indexOf('pin:'))
    expect(text.indexOf('pin:')).toBeLessThan(text.indexOf('extra:'))
    expect((parse(text) as YamlConfig).renderers.faction?.pin).toEqual({ color: 'sea', icon: 'flag', note: 'kept' })
  })

  it('creates pin under a renderer that has none, and drops an emptied pin', () => {
    const base = parseConfig(parse(original)).config
    const withPin = config({ ...base.renderers, location: { ...base.renderers.location!, pin: { shape: 'circle' } } })
    const text = apply(original, withPin)
    expect((parse(text) as YamlConfig).renderers.location).toEqual({ types: ['location'], pin: { shape: 'circle' } })
    const cleared = parseConfig(parse(text)).config
    const back = apply(text, config({ ...cleared.renderers, location: { ...cleared.renderers.location!, pin: undefined } }))
    expect((parse(back) as YamlConfig).renderers.location).toEqual({ types: ['location'] })
  })

  it('creates a renderer entry holding only a pin', () => {
    const text = apply(null, config({ item: entry({ pin: { color: 'moss' } }) }))
    expect(text).toBe('renderers:\n  item:\n    pin: {color: moss}\n')
  })

  it('returns an unchanged file verbatim', () => {
    expect(apply(original, parseConfig(parse(original)).config)).toBe(original)
  })
})

describe('config schema', () => {
  it('reports key collisions, duplicate types and empty values as issues', () => {
    const { issues } = parseConfig({
      typeKey: ' ',
      renderers: {
        character: { types: ['NPC', ' '], keys: { affiliation: 'location', title: '' } },
        location: { types: ['npc'] }
      }
    })
    expect(issues.map((i) => i.path)).toEqual([
      'typeKey',
      'renderers.character.keys.title',
      'renderers.character.keys.location',
      'renderers.character.types',
      'renderers.location.types'
    ])
  })

  it('reserves the type key and map-pins so a field cannot change the note renderer', () => {
    const { issues } = parseConfig({ typeKey: 'kind', renderers: { character: { keys: { title: 'kind', affiliation: 'map-pins' } } } })
    expect(issues.map((i) => i.path)).toEqual(['renderers.character.keys.title', 'renderers.character.keys.affiliation'])
    expect(issues[0]?.message).toContain('reserved')
    // A default key equal to the type key is caught too.
    expect(parseConfig({ typeKey: 'title', renderers: { character: {} } }).issues.map((i) => i.path)).toEqual(['renderers.character.keys.title'])
  })

  it('reports renderers whose entry cannot be read as invalid', () => {
    expect(parseConfig({ renderers: { character: { types: 'oops' }, location: { types: ['x'] } } }).invalid).toEqual(['character'])
  })
})
