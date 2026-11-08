import fc from 'fast-check'
import { isMap, isScalar } from 'yaml'
import { describe, expect, it } from 'vitest'
import { parseFrontmatter, removeFrontmatterKey, setFrontmatterKey } from '../../../src/shared/frontmatter'

const KEYS = ['title', 'type', 'tags', 'aliases', 'note', 'x-unknown', 'map-pins', 'loc']

const entry = (key: string): fc.Arbitrary<readonly string[]> =>
  fc.oneof(
    fc.constantFrom('plain text', '42', 'true', '"quoted: yes"', "'single'", '"[[Link|Alias]]"', 'x # trailing comment', '# only a comment', '   # spaced comment', '').map((v) => [`${key}: ${v}`.trimEnd()]),
    fc.constantFrom('', '  ', '    ').chain((ind) =>
      fc.array(fc.constantFrom('a', '"[[B]]"', 'c d', '3'), { minLength: 1, maxLength: 3 }).map((items) => [`${key}:`, ...items.map((i) => `${ind}- ${i}`)])
    ),
    fc.constantFrom('[a, b]', '[]', '{a: 1}').map((v) => [`${key}: ${v}`]),
    fc.constant([`${key}: |`, '  line one', '  line two']),
    fc.constant([`${key}:`, '  - map: "[[Coast]]"', '    x: 1', '    y: 2.5', '  - map: "[[Other]]"', '    x: 3', '    y: 4', '    style: rumour']),
    fc.constant([`${key}:`, '  nested: 1', '  other: [1, 2]'])
  )

const comment = fc.constantFrom('# a comment', '', '#another')

const docArb = fc
  .record({
    keys: fc.shuffledSubarray(KEYS, { minLength: 0, maxLength: 6 }),
    crlf: fc.boolean(),
    bom: fc.boolean(),
    trailingNewline: fc.boolean(),
    frontmatter: fc.boolean(),
    dots: fc.boolean(),
    body: fc.constantFrom('', 'Body text\n', '# Heading\n\n[[Link]] and more\n', 'no newline'),
    seed: fc.nat()
  })
  .chain((r) =>
    fc
      .tuple(fc.tuple(...r.keys.map(entry)), fc.array(comment, { minLength: r.keys.length + 1, maxLength: r.keys.length + 1 }))
      .map(([entries, comments]) => {
        const lines: string[] = []
        entries.forEach((e, i) => {
          if (comments[i]) lines.push(comments[i])
          lines.push(...e)
        })
        const nl = r.crlf ? '\r\n' : '\n'
        let text = ''
        if (r.frontmatter) {
          text = `---${nl}${lines.map((l) => l + nl).join('')}${r.dots ? '...' : '---'}${nl}`
        }
        text += r.trailingNewline || !r.body ? r.body : r.body.replace(/\n$/, '')
        return { text: (r.bom ? '﻿' : '') + text, keys: r.keys, frontmatter: r.frontmatter }
      })
  )

const valueArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.string(),
  fc.string({ unit: 'grapheme' }),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.string(), { maxLength: 4 }),
  fc.array(fc.record({ map: fc.string().map((s) => `[[${s.replace(/[[\]]/g, '')}]]`), x: fc.integer(), y: fc.integer() }), { maxLength: 3 })
)

/** Raw source text of each top-level pair (key start to value end). */
function rawPairs(fileText: string): Map<string, string> {
  const { doc, split } = parseFrontmatter(fileText)
  const out = new Map<string, string>()
  if (!doc || !isMap(doc.contents) || !split.frontmatter) return out
  for (const p of doc.contents.items) {
    if (!isScalar(p.key) || !p.key.range) continue
    const end = (p.value as { range?: number[] } | null)?.range?.[1] ?? p.key.range[1]
    out.set(String(p.key.value), split.frontmatter.text.slice(p.key.range[0], end).replace(/(\r?\n)$/, ''))
  }
  return out
}

describe('frontmatter edits (property)', () => {
  it('generated documents are valid', () => {
    fc.assert(fc.property(docArb, ({ text }) => {
        expect(parseFrontmatter(text).errors).toEqual([])
      })
    )
  })

  it('a no-op set is byte-identical', () => {
    fc.assert(
      fc.property(docArb, ({ text }) => {
        const { data } = parseFrontmatter(text)
        for (const [key, value] of Object.entries(data)) {
          expect(setFrontmatterKey(text, key, value)).toEqual({ ok: true, value: text })
        }
      })
    )
  })

  it('set then parse yields the value; other keys keep their raw text; EOL/BOM/body are kept', () => {
    fc.assert(
      fc.property(docArb, fc.constantFrom(...KEYS, 'brand-new'), valueArb, ({ text, frontmatter }, key, value) => {
        const result = setFrontmatterKey(text, key, value)
        expect(result.ok).toBe(true)
        if (!result.ok) return
        const after = result.value
        const parsed = parseFrontmatter(after)
        expect(parsed.errors).toEqual([])
        expect(parsed.data[key]).toEqual(value)

        const before = rawPairs(text)
        const now = rawPairs(after)
        for (const [k, raw] of before) if (k !== key) expect(now.get(k)).toBe(raw)

        const a = parseFrontmatter(text).split
        const b = parsed.split
        expect(b.bom).toBe(a.bom)
        if (frontmatter) expect(b.eol).toBe(a.eol)
        expect(b.body).toBe(a.body)
        // Applying the same edit again changes nothing.
        expect(setFrontmatterKey(after, key, value)).toEqual({ ok: true, value: after })
      })
    )
  })

  it('keeps the trailing comment of an empty value, for inline and block replacements', () => {
    fc.assert(
      fc.property(fc.constantFrom('', '  ', '    '), fc.constantFrom('# current', '#c'), fc.boolean(), fc.constantFrom(12, 'a b', ['x', 'y']), (pad, note, crlf, value) => {
        const nl = crlf ? '\r\n' : '\n'
        const text = `---${nl}hp: ${pad}${note}${nl}other: 1${nl}---${nl}`
        const result = setFrontmatterKey(text, 'hp', value)
        expect(result.ok).toBe(true)
        if (!result.ok) return
        const parsed = parseFrontmatter(result.value)
        expect(parsed.errors).toEqual([])
        expect(parsed.data).toEqual({ hp: value, other: 1 })
        expect(result.value).toContain(` ${pad}${note}`.replace(/^ /, '')) // comment text and its spacing survive
        expect(result.value).not.toMatch(/[^\s]#/)
      })
    )
  })

  it('remove drops only that key', () => {
    fc.assert(
      fc.property(docArb, fc.constantFrom(...KEYS), ({ text }, key) => {
        const result = removeFrontmatterKey(text, key)
        expect(result.ok).toBe(true)
        if (!result.ok) return
        const before = parseFrontmatter(text)
        const after = parseFrontmatter(result.value)
        expect(after.errors).toEqual([])
        const { [key]: _removed, ...rest } = before.data
        void _removed
        expect(after.data).toEqual(rest)
        expect(after.split.body).toBe(before.split.body)
        for (const [k, raw] of rawPairs(text)) if (k !== key) expect(rawPairs(result.value).get(k)).toBe(raw)
      })
    )
  })
})
