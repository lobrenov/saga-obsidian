import { describe, expect, it } from 'vitest'
import { updatePins as updatePin, type PinOpBuilder } from '../../src/obsidian/vault'
import { entryMatcher, locateEntry } from '../../src/map/pinWrites'
import { parseFrontmatter } from '../../src/shared/frontmatter'
import type { PinOp } from '../../src/shared/schemas/pins'
import { FakeApp } from '../fakes/obsidian'

const BOM = '﻿'
const text = (eol: string): string =>
  [
    `${BOM}---`,
    '# kept comment',
    'type: Character',
    'map-pins:',
    '  - map: "[[Coast]]"',
    '    x: 10',
    '    y: 20',
    '    note: keep',
    '  - map: "[[Elsewhere]]"',
    '    x: 1',
    '    y: 1',
    'tags: [a, b] # trailing',
    '---',
    '# Body',
    ''
  ].join(eol)

const isCoast = (link: string): boolean => link === '[[Coast]]'
const at = (x: number, y: number): PinOpBuilder => (list) => {
  const index = locateEntry(list, 0, entryMatcher(isCoast, x, y))
  return index === null ? null : { kind: 'move', index, x: 11.26, y: 21 }
}

/** The file with the map-pins value text removed, to compare everything else. */
const withoutPins = (source: string): string => source.replace(/map-pins:[\s\S]*?(?=tags:)/, '')

describe.each([['\n'], ['\r\n']])('updatePin with %j line endings', (eol) => {
  const setup = () => {
    const fake = new FakeApp()
    fake.addFile('Coast.md')
    const file = fake.addFile('Bob.md', text(eol))
    return { fake, file, app: fake.asApp() }
  }

  it.each<[string, PinOpBuilder, (pins: unknown[]) => void]>([
    ['add', () => ({ kind: 'add', pin: { map: '[[Coast]]', x: 5.55, y: 6, icon: 'tent' } }), (pins) => expect(pins[2]).toEqual({ map: '[[Coast]]', x: 5.6, y: 6, icon: 'tent' })],
    ['move', at(10, 20), (pins) => expect(pins[0]).toEqual({ map: '[[Coast]]', x: 11.3, y: 21, note: 'keep' })],
    ['look', (list) => ({ kind: 'look', index: locateEntry(list, 0, entryMatcher(isCoast, 10, 20)) ?? 0, icon: 'scroll-text' }), (pins) => expect(pins[0]).toMatchObject({ icon: 'scroll-text', note: 'keep' })],
    ['remove', (list) => ({ kind: 'remove', index: locateEntry(list, 0, entryMatcher(isCoast, 10, 20)) ?? 0 }), (pins) => expect(pins).toEqual([{ map: '[[Elsewhere]]', x: 1, y: 1 }])]
  ])('%s writes only the map-pins value', async (_name, build, check) => {
    const { fake, file, app } = setup()
    const result = await updatePin(app, file, build)
    expect(result.ok).toBe(true)
    const after = fake.text('Bob.md')
    expect(withoutPins(after)).toBe(withoutPins(text(eol)))
    expect(after.startsWith(BOM)).toBe(true)
    check(parseFrontmatter(after).data['map-pins'] as unknown[])
  })

  it('removing the last pin drops the key and nothing else', async () => {
    const fake = new FakeApp()
    const file = fake.addFile('Bob.md', ['---', 'type: Character', 'map-pins:', '  - map: "[[Coast]]"', '    x: 1', '    y: 2', 'tags: [a]', '---', ''].join(eol))
    const result = await updatePin(fake.asApp(), file, () => ({ kind: 'remove', index: 0 }))
    expect(result.ok).toBe(true)
    expect(fake.text('Bob.md')).toBe(['---', 'type: Character', 'tags: [a]', '---', ''].join(eol))
  })

  it('finds the entry in the file as it is now, not by the index the pin was shown with', async () => {
    const { fake, file, app } = setup()
    const reordered = text(eol).replace(/ {2}- map: "\[\[Coast]]"[\s\S]*?note: keep\r?\n/, '').replace(/( {4}y: 1\r?\n)/, `$1  - map: "[[Coast]]"${eol}    x: 10${eol}    y: 20${eol}    note: keep${eol}`)
    fake.addFile('Bob.md', reordered)
    const seen: number[] = []
    const result = await updatePin(app, file, (list) => {
      const index = locateEntry(list, 0, entryMatcher(isCoast, 10, 20))
      seen.push(index ?? -1)
      return index === null ? null : { kind: 'remove', index }
    })
    expect(result.ok).toBe(true)
    expect(seen).toEqual([1])
    expect(parseFrontmatter(fake.text('Bob.md')).data['map-pins']).toEqual([{ map: '[[Elsewhere]]', x: 1, y: 1 }])
  })

  it('fails and leaves the file when the entry is gone', async () => {
    const { fake, file, app } = setup()
    fake.addFile('Bob.md', text(eol).replace('x: 10', 'x: 99'))
    const before = fake.text('Bob.md')
    const result = await updatePin(app, file, at(10, 20))
    expect(result).toMatchObject({ ok: false, error: { kind: 'not-found' } })
    expect(fake.text('Bob.md')).toBe(before)
    expect(fake.processed).toEqual([])
  })

  it('fails and leaves the file when the frontmatter is invalid', async () => {
    const fake = new FakeApp()
    const broken = '---\nmap-pins: [unclosed\n---\nbody\n'
    const file = fake.addFile('Bad.md', broken)
    const result = await updatePin(fake.asApp(), file, () => ({ kind: 'add', pin: { map: '[[Coast]]', x: 1, y: 1 } }))
    expect(result).toMatchObject({ ok: false, error: { kind: 'parse' } })
    expect(fake.text('Bad.md')).toBe(broken)
  })
})

describe('updatePin on a note without pins', () => {
  it('adds the key', async () => {
    const fake = new FakeApp()
    const file = fake.addFile('Bob.md', '---\ntype: Character\n---\nbody\n')
    const op: PinOp = { kind: 'add', pin: { map: '[[Coast]]', x: 1, y: 2 } }
    expect((await updatePin(fake.asApp(), file, () => op)).ok).toBe(true)
    expect(fake.text('Bob.md')).toBe('---\ntype: Character\nmap-pins:\n  - map: "[[Coast]]"\n    x: 1\n    y: 2\n---\nbody\n')
  })

  it('fails to move a pin the note does not have', async () => {
    const fake = new FakeApp()
    const file = fake.addFile('Bob.md', '---\ntype: Character\n---\nbody\n')
    expect(await updatePin(fake.asApp(), file, () => null)).toMatchObject({ ok: false })
    expect(fake.text('Bob.md')).toBe('---\ntype: Character\n---\nbody\n')
  })
})

describe('locateEntry', () => {
  const entry = (x: number): unknown => ({ map: '[[Coast]]', x, y: 0 })
  it('keeps the index while that entry matches, else takes the single match, else none', () => {
    const match = entryMatcher(isCoast, 5, 0)
    expect(locateEntry([entry(5), entry(5)], 1, match)).toBe(1)
    expect(locateEntry([entry(1), entry(5)], 0, match)).toBe(1)
    expect(locateEntry([entry(5), entry(5)], 7, match)).toBeNull()
    expect(locateEntry([entry(1)], 0, match)).toBeNull()
  })

  it('matches an entry whatever way its link is written', () => {
    const match = entryMatcher((link) => /Coast/.test(link), 5, 0)
    expect(match({ map: '[[Maps/Coast|the coast]]', x: 5, y: 0 })).toBe(true)
    expect(match({ map: '[[Elsewhere]]', x: 5, y: 0 })).toBe(false)
    expect(match('nonsense')).toBe(false)
  })
})
