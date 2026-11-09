import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import type { Config } from '../../../src/shared/schemas/config'
import { buildConfigText } from '../../../src/shared/schemas/configWrite'

const entry = (over: Partial<NonNullable<Config['renderers']['character']>> = {}) => ({ types: [], keys: {}, templates: [], ...over })
const base: Config = { typeKey: 'type', renderers: { character: entry({ types: ['character'] }), location: entry({ types: ['location'] }) } }

describe('buildConfigText', () => {
  it('builds the file text from the edit', () => {
    const edited: Config = { ...base, renderers: { ...base.renderers, location: entry({ types: ['location', 'place'] }) } }
    const result = buildConfigText(null, edited, base, [])
    expect(result.ok && result.value.includes('place')).toBe(true)
  })

  it('refuses a config with issues', () => {
    const clash: Config = { ...base, renderers: { ...base.renderers, location: entry({ types: ['character'] }) } }
    const result = buildConfigText(null, clash, base, [])
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.message).toContain('already mapped')
  })

  it('refuses a change to an entry that could not be read, but not to others', () => {
    const edited: Config = { ...base, renderers: { ...base.renderers, character: entry({ types: ['character', 'NPC'] }) } }
    const refused = buildConfigText('renderers: {}\n', edited, base, ['character'])
    expect(refused).toMatchObject({ ok: false, error: { kind: 'validation', message: 'The "character" entry in renderers.yaml could not be read; fix it in the file' } })
    const other = { ...base, renderers: { ...base.renderers, location: entry({ types: ['place'] }) } }
    expect(buildConfigText('renderers: {}\n', other, base, ['character']).ok).toBe(true)
  })

  it('leaves an entry it could not read untouched', () => {
    const original = [
      'renderers:',
      '  character:',
      '    types: not-a-list # broken on purpose',
      '    keys: { title: job }',
      '    templates: [Templates/Character.md]',
      '  location:',
      '    types: [location]',
      ''
    ].join('\n')
    const edited: Config = { ...base, renderers: { ...base.renderers, location: entry({ types: ['location', 'place'] }) } }
    const result = buildConfigText(original, edited, base, ['character'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toContain('types: not-a-list # broken on purpose')
    expect(result.value).toContain('keys: {title: job}')
    expect(result.value).toContain('templates: [Templates/Character.md]')
    expect((parse(result.value) as { renderers: { location: { types: string[] } } }).renderers.location.types).toEqual(['location', 'place'])
  })

  it('applies only what changed between the base and the new config', () => {
    const original = 'renderers:\n  character:\n    types: [character]\n    keys: { title: job }\n'
    const loaded: Config = { typeKey: 'type', renderers: { character: entry({ types: ['character'], keys: { title: 'job' } }) } }
    // An edit that only adds a type must not rewrite the keys, even though the new config carries them.
    const next: Config = { ...loaded, renderers: { character: { ...loaded.renderers.character!, types: ['character', 'NPC'] } } }
    expect(buildConfigText(original, next, loaded, [])).toEqual({ ok: true, value: 'renderers:\n  character:\n    types: [character, NPC]\n    keys: {title: job}\n' })
  })

  it('reports YAML that cannot be parsed', () => {
    expect(buildConfigText('a: [', base, base, [])).toMatchObject({ ok: false, error: { kind: 'parse' } })
  })
})
