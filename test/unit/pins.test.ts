import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../../src/shared/frontmatter'
import { applyPinOp, applyPinOpToText, pinEntry, pinYaml, roundCoord } from '../../src/shared/pins/ops'
import { STYLE_ICONS } from '../../src/shared/pins/look'
import type { PinOp } from '../../src/shared/schemas/pins'

const list = (): unknown[] => [
  { map: '[[Coast]]', x: 1, y: 2, style: 'rumour', note: 'keep me' },
  'not a mapping',
  { map: '[[Coast]]', x: 'wrong', y: 3 },
  { map: '[[Coast]]', x: 5, y: 6 }
]
const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error))
  return r.value as T
}

describe('applyPinOp', () => {
  it('adds a pin at the end and leaves the others untouched', () => {
    const before = list()
    const next = must(applyPinOp(before, { kind: 'add', pin: { map: '[[Coast]]', x: 10.26, y: 20, icon: 'tent' } }))
    expect(next.slice(0, 4)).toEqual(list())
    expect(next[4]).toEqual({ map: '[[Coast]]', x: 10.3, y: 20, icon: 'tent' })
    expect(before).toEqual(list())
  })

  it('writes no defaults and no style for a new entry, and starts a list when there is none', () => {
    expect(must(applyPinOp(undefined, { kind: 'add', pin: { map: '[[Coast]]', x: 1, y: 2, style: 'camp' } }))).toEqual([{ map: '[[Coast]]', x: 1, y: 2 }])
    expect(must(applyPinOp(null, { kind: 'add', pin: { map: '[[Coast]]', x: 1, y: 2 } }))).toEqual([{ map: '[[Coast]]', x: 1, y: 2 }])
  })

  it('moves one pin, keeping its unknown keys and key order', () => {
    const next = must(applyPinOp(list(), { kind: 'move', index: 0, x: 7.04, y: 8.96 }))
    expect(Object.keys(next[0] as object)).toEqual(['map', 'x', 'y', 'icon', 'note'])
    expect(next[0]).toEqual({ map: '[[Coast]]', x: 7, y: 9, icon: 'message-circle', note: 'keep me' })
    expect(next.slice(1)).toEqual(list().slice(1))
  })

  it('removes one pin, including an invalid entry', () => {
    expect(must(applyPinOp(list(), { kind: 'remove', index: 0 }))).toEqual(list().slice(1))
    expect(must(applyPinOp(list(), { kind: 'remove', index: 2 }))).toEqual([list()[0], list()[1], list()[3]])
  })

  it('migrates the style to its icon on a move, in place; an entry with both keeps its icon; auto and unknown styles are dropped', () => {
    const styled = (extra: Record<string, unknown>): unknown[] => [{ map: '[[Coast]]', x: 1, y: 2, ...extra, note: 'n' }]
    const move = (extra: Record<string, unknown>): unknown => must(applyPinOp(styled(extra), { kind: 'move', index: 0, x: 3, y: 4 }))[0]
    for (const [style, icon] of Object.entries(STYLE_ICONS)) expect(move({ style })).toEqual({ map: '[[Coast]]', x: 3, y: 4, icon, note: 'n' })
    expect(move({ style: 'danger', icon: 'key' })).toEqual({ map: '[[Coast]]', x: 3, y: 4, icon: 'key', note: 'n' })
    expect(move({ icon: 'key', style: 'danger' })).toEqual({ map: '[[Coast]]', x: 3, y: 4, icon: 'key', note: 'n' })
    expect(move({ style: 'danger', icon: 'bogus' })).toEqual({ map: '[[Coast]]', x: 3, y: 4, icon: 'skull', note: 'n' })
    expect(move({ style: 'auto' })).toEqual({ map: '[[Coast]]', x: 3, y: 4, note: 'n' })
    expect(move({ style: 'sparkly' })).toEqual({ map: '[[Coast]]', x: 3, y: 4, note: 'n' })
  })

  it('sets, replaces and removes look keys on one entry, leaving other keys, their order and other entries', () => {
    const set = must(applyPinOp(list(), { kind: 'look', index: 3, shape: 'herald', color: 'rust', icon: 'skull' }))
    expect(set[3]).toEqual({ map: '[[Coast]]', x: 5, y: 6, shape: 'herald', color: 'rust', icon: 'skull' })
    const only = must(applyPinOp(list(), { kind: 'look', index: 3, color: 'sea' }))
    expect(only[3]).toEqual({ map: '[[Coast]]', x: 5, y: 6, color: 'sea' })
    expect([...set.slice(0, 3), ...set.slice(4)]).toEqual(list().slice(0, 3))
    const withLook = [{ map: '[[Coast]]', x: 1, y: 2, shape: 'flag', color: 'rust', icon: 'key', note: 'n' }]
    const changed = must(applyPinOp(withLook, { kind: 'look', index: 0, color: 'moss', icon: null }))[0]
    expect(Object.keys(changed as object)).toEqual(['map', 'x', 'y', 'shape', 'color', 'note'])
    expect(changed).toEqual({ map: '[[Coast]]', x: 1, y: 2, shape: 'flag', color: 'moss', note: 'n' })
    expect(must(applyPinOp(withLook, { kind: 'look', index: 0, shape: null, color: null, icon: null }))[0]).toEqual({ map: '[[Coast]]', x: 1, y: 2, note: 'n' })
  })

  it('migrates the style on a look op: the new icon wins, and a removed icon leaves none', () => {
    const entry = (): unknown[] => [{ map: '[[Coast]]', x: 1, y: 2, style: 'danger', note: 'n' }]
    expect(must(applyPinOp(entry(), { kind: 'look', index: 0, color: 'rust' }))[0]).toEqual({ map: '[[Coast]]', x: 1, y: 2, icon: 'skull', note: 'n', color: 'rust' })
    expect(must(applyPinOp(entry(), { kind: 'look', index: 0, icon: 'key' }))[0]).toEqual({ map: '[[Coast]]', x: 1, y: 2, icon: 'key', note: 'n' })
    expect(must(applyPinOp(entry(), { kind: 'look', index: 0, icon: null }))[0]).toEqual({ map: '[[Coast]]', x: 1, y: 2, note: 'n' })
  })

  it('refuses a missing pin, a non-mapping entry and a map-pins value that is not a list', () => {
    expect(applyPinOp(list(), { kind: 'move', index: 9, x: 1, y: 1 }).ok).toBe(false)
    expect(applyPinOp(list(), { kind: 'look', index: 1, color: 'rust' }).ok).toBe(false)
    expect(applyPinOp(list(), { kind: 'move', index: 1, x: 1, y: 1 }).ok).toBe(false)
    expect(applyPinOp(list(), { kind: 'remove', index: 9 }).ok).toBe(false)
    expect(applyPinOp('nope', { kind: 'remove', index: 0 }).ok).toBe(false)
    expect(applyPinOp({}, { kind: 'add', pin: { map: '[[Coast]]', x: 1, y: 2 } }).ok).toBe(false)
  })
})

describe('applyPinOpToText', () => {
  const note = (fm: string, eol = '\n', bom = ''): string => `${bom}---${eol}${fm.split('\n').join(eol)}${eol}---${eol}# Body${eol}${eol}text${eol}`
  const fm = [
    '# keep this comment',
    'type: location   # trailing',
    'aliases: [Salty, "Port"]',
    'weird:   {a: 1}',
    'map-pins:',
    '  - map: "[[Coast]]"',
    '    x: 1',
    '    y: 2',
    '    custom: [1, 2]',
    'after: "last"'
  ].join('\n')

  /** Everything outside the `map-pins` block is identical; returns the text of the block. */
  function block(text: string): string {
    const match = /map-pins:[\s\S]*?(?=\r?\nafter:)/.exec(text)
    if (!match) throw new Error('no map-pins block')
    return match[0]
  }

  for (const [label, eol, bom] of [
    ['LF', '\n', ''],
    ['CRLF', '\r\n', ''],
    ['BOM and CRLF', '\r\n', '﻿']
  ] as const) {
    describe(label, () => {
      const text = note(fm, eol, bom)
      const ops: PinOp[] = [
        { kind: 'add', pin: { map: '[[Coast]]', x: 3, y: 4, icon: 'tent' } },
        { kind: 'move', index: 0, x: 9, y: 8 },
        { kind: 'look', index: 0, icon: 'skull' }
      ]
      for (const op of ops) {
        it(`${op.kind} changes only the map-pins value`, () => {
          const next = must(applyPinOpToText(text, op))
          expect(next).not.toBe(text)
          expect(next.replace(block(next), '@@')).toBe(text.replace(block(text), '@@'))
          expect(next.startsWith(bom + '---')).toBe(true)
          if (eol === '\r\n') expect(next.replace(/\r\n/g, '')).not.toContain('\n')
          const data = parseFrontmatter(next).data
          expect(data.after).toBe('last')
          expect(data.weird).toEqual({ a: 1 })
        })
      }

      it('keeps unknown keys of the changed entry', () => {
        const data = parseFrontmatter(must(applyPinOpToText(text, { kind: 'move', index: 0, x: 9, y: 8 }))).data
        expect(data['map-pins']).toEqual([{ map: '[[Coast]]', x: 9, y: 8, custom: [1, 2] }])
      })

      it('removing the only pin removes the key and nothing else', () => {
        const next = must(applyPinOpToText(text, { kind: 'remove', index: 0 }))
        expect(next).toBe(text.replace(block(text) + eol, ''))
      })
    })
  }

  it('adds the key at the end of a block that has none, or creates the block', () => {
    expect(must(applyPinOpToText('---\ntype: x\n---\nbody\n', { kind: 'add', pin: { map: '[[Coast]]', x: 1, y: 2 } }))).toBe(
      '---\ntype: x\nmap-pins:\n  - map: "[[Coast]]"\n    x: 1\n    y: 2\n---\nbody\n'
    )
    expect(must(applyPinOpToText('body\n', { kind: 'add', pin: { map: '[[Coast]]', x: 1, y: 2 } }))).toBe('---\nmap-pins:\n  - map: "[[Coast]]"\n    x: 1\n    y: 2\n---\nbody\n')
  })

  it('refuses invalid frontmatter', () => {
    expect(applyPinOpToText('---\na: [\n---\n', { kind: 'add', pin: { map: '[[Coast]]', x: 1, y: 2 } }).ok).toBe(false)
  })
})

describe('helpers', () => {
  it('rounds to one decimal', () => {
    expect(roundCoord(952.049)).toBe(952)
    expect(roundCoord(0.25)).toBe(0.3)
  })
  it('previews the YAML that is written', () => {
    expect(pinYaml({ map: '[[The Shattered Coast]]', x: 952, y: 720, icon: 'message-circle' })).toBe('map-pins:\n  - map: "[[The Shattered Coast]]"\n    x: 952\n    y: 720\n    icon: message-circle')
    expect(pinEntry({ map: '[[A]]', x: 1, y: 2 })).toEqual({ map: '[[A]]', x: 1, y: 2 })
  })
})
