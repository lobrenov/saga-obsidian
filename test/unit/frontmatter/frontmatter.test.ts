import { describe, expect, it } from 'vitest'
import { parseFrontmatter, removeFrontmatterKey, setFrontmatterKey, splitFrontmatter } from '../../../src/shared/frontmatter'

const set = (text: string, key: string, value: unknown): string => {
  const r = setFrontmatterKey(text, key, value)
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}

describe('splitFrontmatter', () => {
  it('splits LF, CRLF, BOM and `...` closers byte-exactly', () => {
    const lf = splitFrontmatter('---\na: 1\n---\nbody\n')
    expect(lf).toMatchObject({ bom: '', eol: '\n', bodyStart: 13, body: 'body\n' })
    expect(lf.frontmatter).toEqual({ start: 0, end: 13, yamlStart: 4, yamlEnd: 9, text: 'a: 1\n' })

    const crlf = splitFrontmatter('﻿---\r\na: 1\r\n...\r\nbody')
    expect(crlf.bom).toBe('﻿')
    expect(crlf.eol).toBe('\r\n')
    expect(crlf.frontmatter).toMatchObject({ start: 1, yamlStart: 6, text: 'a: 1\r\n' })
    expect(crlf.body).toBe('body')
  })
  it('handles empty blocks, closer at EOF and non-frontmatter', () => {
    expect(splitFrontmatter('---\n---').frontmatter).toMatchObject({ text: '', end: 7 })
    expect(splitFrontmatter('---\na: 1\n---').body).toBe('')
    expect(splitFrontmatter('---\na: 1\n').frontmatter).toBeNull()
    expect(splitFrontmatter('text\n---\na\n---\n').frontmatter).toBeNull()
    expect(splitFrontmatter(' ---\na\n---\n').frontmatter).toBeNull()
    const none = splitFrontmatter('﻿hello\r\nthere')
    expect(none).toMatchObject({ eol: '\r\n', bodyStart: 1, body: 'hello\r\nthere' })
    expect(splitFrontmatter('x').eol).toBe('\n')
  })
})

describe('parseFrontmatter', () => {
  it('parses data and reports invalid YAML without throwing', () => {
    expect(parseFrontmatter('---\ntitle: A\ntags: [x, y]\n---\n').data).toEqual({ title: 'A', tags: ['x', 'y'] })
    expect(parseFrontmatter('no fm').data).toEqual({})
    const bad = parseFrontmatter('---\na: [1\nb: : :\n---\n')
    expect(bad.errors.length).toBeGreaterThan(0)
    expect(bad.errors[0]?.from).toBeGreaterThanOrEqual(4)
    expect(parseFrontmatter('---\n- a\n---\n').errors[0]?.message).toMatch(/mapping/)
  })
})

describe('setFrontmatterKey', () => {
  const file = '---\n# head\ntitle: Old # keep\ntype:   npc\ntags:\n  - a\n  - b\nz: 1\n---\nBody\n'

  it('replaces only the value span', () => {
    expect(set(file, 'title', 'New')).toBe(file.replace('title: Old', 'title: New'))
    expect(set(file, 'type', 'pc')).toBe(file.replace('npc', 'pc'))
  })
  it('quotes wikilinks and ambiguous scalars', () => {
    expect(set('---\na: 1\n---\n', 'loc', '[[X]]')).toBe('---\na: 1\nloc: "[[X]]"\n---\n')
    expect(set('---\na: 1\n---\n', 'a', '12')).toBe('---\na: "12"\n---\n')
  })
  it('replaces block lists keeping indentation, and swaps between kinds', () => {
    expect(set(file, 'tags', ['c'])).toBe(file.replace('  - a\n  - b', '  - c'))
    expect(set('---\ntags:\n- a\nz: 1\n---\n', 'tags', ['p', 'q'])).toBe('---\ntags:\n- p\n- q\nz: 1\n---\n')
    expect(set('---\ntags:\n    - a\nz: 1\n---\n', 'tags', ['p'])).toBe('---\ntags:\n    - p\nz: 1\n---\n')
    expect(set(file, 'tags', 'one')).toBe(file.replace('tags:\n  - a\n  - b', 'tags: one'))
    expect(set('---\ntags: [a]\nz: 1\n---\n', 'tags', ['p', 'q'])).toBe('---\ntags:\n  - p\n  - q\nz: 1\n---\n')
    expect(set('---\ntags: # why\n  - a\n---\n', 'tags', 'x')).toBe('---\ntags: x # why\n---\n')
  })
  it('fills empty values and block scalars', () => {
    expect(set('---\na:\nb: 1\n---\n', 'a', 'v')).toBe('---\na: v\nb: 1\n---\n')
    expect(set('---\na: |\n  x\n  y\nb: 1\n---\n', 'a', 'v')).toBe('---\na: v\nb: 1\n---\n')
    expect(set('---\na: 1\nb: 2\n---\n', 'a', 'x\ny')).toBe('---\na: |-\n  x\n  y\nb: 2\n---\n')
  })
  it('handles map-pins (arrays of objects)', () => {
    const pins = [
      { map: '[[Coast]]', x: 952, y: 720, style: 'rumour' },
      { map: '[[Other]]', x: 1.5, y: -2 }
    ]
    const out = set('---\ntitle: A\n---\n', 'map-pins', pins)
    expect(out).toBe(
      '---\ntitle: A\nmap-pins:\n  - map: "[[Coast]]"\n    x: 952\n    y: 720\n    style: rumour\n  - map: "[[Other]]"\n    x: 1.5\n    y: -2\n---\n'
    )
    expect(parseFrontmatter(out).data['map-pins']).toEqual(pins)
    const replaced = set(out, 'map-pins', [pins[0]])
    expect(parseFrontmatter(replaced).data['map-pins']).toEqual([pins[0]])
    expect(replaced.startsWith('---\ntitle: A\nmap-pins:\n')).toBe(true)
  })
  it('appends missing keys using the file EOL', () => {
    expect(set('---\r\na: 1\r\n---\r\nB', 'k', ['x'])).toBe('---\r\na: 1\r\nk:\r\n  - x\r\n---\r\nB')
    expect(set('---\n---\n', 'k', 1)).toBe('---\nk: 1\n---\n')
    expect(set('---\na: 1\n...\nB', 'k', 1)).toBe('---\na: 1\nk: 1\n...\nB')
  })
  it('creates a block when missing, preserving BOM and EOL', () => {
    expect(set('Body\n', 'type', 'npc')).toBe('---\ntype: npc\n---\nBody\n')
    expect(set('﻿Body\r\nmore', 'type', 'npc')).toBe('﻿---\r\ntype: npc\r\n---\r\nBody\r\nmore')
    expect(set('', 'a', 1)).toBe('---\na: 1\n---\n')
  })
  it('is byte-identical for a no-op', () => {
    expect(set(file, 'title', 'Old')).toBe(file)
    expect(set(file, 'tags', ['a', 'b'])).toBe(file)
  })
  it('refuses invalid YAML', () => {
    const r = setFrontmatterKey('---\na: [1\n---\n', 'a', 2)
    expect(r).toMatchObject({ ok: false, error: { kind: 'parse' } })
    expect(setFrontmatterKey('---\na: 1\na: 2\n---\n', 'b', 2).ok).toBe(false)
    expect(removeFrontmatterKey('---\na: [1\n---\n', 'a').ok).toBe(false)
  })
})

describe('removeFrontmatterKey', () => {
  it('removes whole entries only', () => {
    const file = '---\n# c\na: 1\nb:\n  - x\n  - y # t\nc: 3 # t\n---\nB'
    const rm = (k: string) => {
      const r = removeFrontmatterKey(file, k)
      if (!r.ok) throw new Error('x')
      return r.value
    }
    expect(rm('a')).toBe('---\n# c\nb:\n  - x\n  - y # t\nc: 3 # t\n---\nB')
    expect(rm('b')).toBe('---\n# c\na: 1\nc: 3 # t\n---\nB')
    expect(rm('c')).toBe('---\n# c\na: 1\nb:\n  - x\n  - y # t\n---\nB')
    expect(rm('nope')).toBe(file)
    expect(removeFrontmatterKey('plain', 'a')).toEqual({ ok: true, value: 'plain' })
  })
})
