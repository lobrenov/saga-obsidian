import { describe, expect, it } from 'vitest'
import { rendererDefs } from '../../../src/shared/renderers/definitions'
import { convertRaw, formatWikiLink, toNoteValue } from '../../../src/shared/renderers/values'
import { createRendererResolver, typesOf } from '../../../src/shared/renderers/resolve'
import { readFrontmatter } from '../../../src/shared/schemas/frontmatter'
import { parseConfig, type Config } from '../../../src/shared/schemas/config'

describe('compatibility', () => {
  it('a links field holding bare names is invalid and converts to [[links]]', () => {
    const { allies } = rendererDefs.faction.fields
    const layers = readFrontmatter(rendererDefs.faction, { allies: ['[[A]]', 'B'] }).fields
    expect(layers.allies.issues).not.toEqual([])
    expect(convertRaw(allies, ['[[A]]', 'B'])).toEqual(['[[A]]', '[[B]]'])
    expect(convertRaw(allies, 'B')).toEqual(['[[B]]'])
    expect(convertRaw(allies, [])).toBeUndefined()
    expect(toNoteValue([{ target: 'A', embed: false }])).toEqual(['[[A]]'])
  })
})

describe('renderer resolution and values', () => {
  const config: Config = { typeKey: 'kind', renderers: { character: { types: ['NPC'], keys: {}, templates: [] }, location: { types: [], keys: {}, templates: [] } } }
  it('resolves case-insensitively through the configured type key, with the id as default type', () => {
    const resolve = createRendererResolver(config)
    expect(resolve({ kind: 'npc' })).toEqual({ type: 'npc', renderer: 'character' })
    expect(resolve({ kind: ' Location ' })).toEqual({ type: 'Location', renderer: 'location' })
    expect(resolve({ kind: 'character' })).toEqual({ type: 'character', renderer: 'document' })
    expect(resolve({ type: 'NPC' })).toEqual({ type: null, renderer: 'document' })
    expect(typesOf(config, 'character')).toEqual(['NPC'])
    expect(typesOf(config, 'location')).toEqual(['location'])
  })

  it('maps lore and event to Lore by default; configured types replace them', () => {
    const resolve = createRendererResolver({ typeKey: 'type', renderers: {} })
    expect(resolve({ type: 'lore' }).renderer).toBe('lore')
    expect(resolve({ type: 'Event' }).renderer).toBe('lore')
    expect(typesOf({ typeKey: 'type', renderers: {} }, 'lore')).toEqual(['lore', 'event'])
    const configured: Config = { typeKey: 'type', renderers: { lore: { types: ['saga'], keys: {}, templates: [] } } }
    expect(createRendererResolver(configured)({ type: 'event' }).renderer).toBe('document')
    expect(createRendererResolver(configured)({ type: 'saga' }).renderer).toBe('lore')
    expect(typesOf(configured, 'lore')).toEqual(['saga'])
  })

  it('does not rename the keys of date fields', () => {
    const { config, issues } = parseConfig({ renderers: { lore: { keys: { when: 'date', where: 'place' } } } })
    expect(config.renderers.lore?.keys).toEqual({ where: 'place' })
    expect(issues.map((issue) => issue.path)).toEqual(['renderers.lore.keys.when'])
  })

  it('converts values that fail their schema', () => {
    const { fields } = rendererDefs.character
    expect(convertRaw(fields.title, 5)).toBe('5')
    expect(convertRaw(fields.title, ['a', 'b'])).toBe('a, b')
    expect(convertRaw(fields.title, { a: 1 })).toBeUndefined()
    expect(convertRaw(fields.location, 'Saltmere')).toBe('[[Saltmere]]')
    expect(convertRaw(fields.location, 'Places/Saltmere.md')).toBe('[[Places/Saltmere.md]]')
    expect(convertRaw(fields.status, 'Dead')).toBe('dead')
    expect(convertRaw(fields.status, 'zombie')).toBeUndefined()
    expect(convertRaw({ kind: 'list', key: 'k', label: 'K' }, 'one')).toEqual(['one'])
    expect(convertRaw({ kind: 'list', key: 'k', label: 'K' }, [1, 'b'])).toEqual(['1', 'b'])
  })

  it('stores links as [[wikilinks]]', () => {
    expect(formatWikiLink({ target: 'Saltmere', embed: false })).toBe('[[Saltmere]]')
    expect(formatWikiLink({ target: 'A', heading: 'H', alias: 'x', embed: false })).toBe('[[A#H|x]]')
    expect(formatWikiLink({ target: 'A', block: 'b1', embed: true })).toBe('![[A#^b1]]')
    expect(toNoteValue({ target: 'portrait.png', embed: false })).toBe('[[portrait.png]]')
    expect(toNoteValue('plain')).toBe('plain')
    expect(toNoteValue(['a'])).toEqual(['a'])
  })
})
