import type { Document, YAMLMap } from 'yaml'
import { Document as YamlDocument, isMap, isNode, isScalar, isSeq } from 'yaml'
import type { Result } from '../result'
import { err, ok } from '../result'
import { parseFrontmatter } from './parse'

interface Style {
  indent: number
  indentSeq: boolean
}

const DEFAULT_STYLE: Style = { indent: 2, indentSeq: true }

type Range = [number, number, number]
const rangeOf = (node: unknown): Range | null => (isNode(node) ? (node.range ?? null) : null)

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return (
    ka.length === kb.length &&
    ka.every((k) => k in b && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  )
}

/** Indentation style of the first block collection value in the map (top-level keys sit at column 0). */
function detectStyle(map: YAMLMap, yaml: string): Style {
  for (const pair of map.items) {
    const node = pair.value
    const range = rangeOf(node)
    if (!range || !((isSeq(node) || isMap(node)) && !node.flow)) continue
    const col = range[0] - (yaml.lastIndexOf('\n', range[0] - 1) + 1)
    if (isSeq(node)) return { indent: col > 0 ? col : 2, indentSeq: col > 0 }
    if (col > 0) return { indent: col, indentSeq: true }
  }
  return DEFAULT_STYLE
}

/** The text after `key:` for a value, e.g. ` text` (inline) or `\n  - a` (block); no trailing newline. */
function renderValue(value: unknown, style: Style): string {
  const text = new YamlDocument({ k: value }).toString({ ...style, lineWidth: 0, singleQuote: false })
  return text.slice(2).replace(/\n$/, '')
}

interface Target {
  fileText: string
  yamlStart: number
  yamlEnd: number
  yaml: string
  doc: Document.Parsed
  map: YAMLMap | null
  data: Record<string, unknown>
  eol: string
}

function load(fileText: string): Result<Target | null> {
  const parsed = parseFrontmatter(fileText)
  const fm = parsed.split.frontmatter
  if (!fm || !parsed.doc) return ok(null)
  const first = parsed.errors[0]
  if (first) return err({ kind: 'parse', message: `Invalid frontmatter: ${first.message}` })
  const map = isMap(parsed.doc.contents) ? parsed.doc.contents : null
  if (map?.flow) return err({ kind: 'parse', message: 'Frontmatter is a flow mapping; not editable' })
  return ok({
    fileText,
    yamlStart: fm.yamlStart,
    yamlEnd: fm.yamlEnd,
    yaml: fm.text,
    doc: parsed.doc,
    map,
    data: parsed.data,
    eol: parsed.split.eol
  })
}

const withEol = (text: string, eol: string) => (eol === '\n' ? text : text.replace(/\n/g, eol))
const splice = (text: string, from: number, to: number, insert: string) => text.slice(0, from) + insert + text.slice(to)

/**
 * Returns the file text with only `key`'s value text replaced (appended as a new key, or a new block created, when missing).
 * A value equal to the current one, or any edit on a file whose YAML is invalid, leaves/refuses the text (`parse` error).
 * `undefined` removes the key.
 */
export function setFrontmatterKey(fileText: string, key: string, value: unknown): Result<string> {
  if (value === undefined) return removeFrontmatterKey(fileText, key)
  const loaded = load(fileText)
  if (!loaded.ok) return loaded
  const t = loaded.value

  if (!t) {
    const { split } = parseFrontmatter(fileText)
    const pair = withEol(new YamlDocument({ [key]: value }).toString({ lineWidth: 0, singleQuote: false }), split.eol)
    return ok(splice(fileText, split.bom.length, split.bom.length, `---${split.eol}${pair}---${split.eol}`))
  }

  const style = t.map ? detectStyle(t.map, t.yaml) : DEFAULT_STYLE
  const pair = t.map?.items.find((p) => isScalar(p.key) && String(p.key.value) === key)
  if (!pair) {
    const text = withEol(new YamlDocument({ [key]: value }).toString({ ...style, lineWidth: 0, singleQuote: false }), t.eol)
    return ok(splice(fileText, t.yamlEnd, t.yamlEnd, text))
  }
  if (key in t.data && deepEqual(t.data[key], value)) return ok(fileText)

  const keyRange = rangeOf(pair.key)
  const colon = keyRange ? t.yaml.indexOf(':', keyRange[1]) : -1
  if (!keyRange || colon < 0) return err({ kind: 'parse', message: `Cannot locate key "${key}"` })

  const valueRange = rangeOf(pair.value)
  const valueStart = valueRange ? valueRange[0] : colon + 1
  let valueEnd = valueRange ? valueRange[1] : colon + 1
  // Block values include their final line break; keep it in place.
  if (valueEnd > valueStart && t.yaml[valueEnd - 1] === '\n') valueEnd -= t.yaml[valueEnd - 2] === '\r' ? 2 : 1
  const between = t.yaml.slice(colon + 1, valueStart)
  const comment = between.includes('\n') ? (/[ \t]+#[^\r\n]*/.exec(between)?.[0] ?? '') : ''

  const rendered = renderValue(value, style)
  // Inline over inline: keep the original spacing after the colon.
  if (!rendered.startsWith('\n') && valueEnd > valueStart && !between.includes('\n')) {
    return ok(splice(fileText, t.yamlStart + valueStart, t.yamlStart + valueEnd, withEol(rendered.slice(1), t.eol)))
  }
  // An empty value followed by a same-line comment (`key:   # note`): keep the comment and the spacing before it.
  const emptyComment = valueEnd === valueStart && t.yaml[valueStart] === '#' ? (/^#[^\r\n]*/.exec(t.yaml.slice(valueStart))?.[0] ?? '') : null
  if (emptyComment !== null) {
    const block = rendered.startsWith('\n')
    const next = block ? between + emptyComment + rendered : rendered + between
    const end = block ? valueEnd + emptyComment.length : valueEnd
    return ok(splice(fileText, t.yamlStart + colon + 1, t.yamlStart + end, withEol(next, t.eol)))
  }
  const next = rendered.startsWith('\n') ? comment + rendered : rendered + comment
  return ok(splice(fileText, t.yamlStart + colon + 1, t.yamlStart + valueEnd, withEol(next, t.eol)))
}

/** Removes `key` (its lines, including a trailing comment on the last line); other text is untouched. */
export function removeFrontmatterKey(fileText: string, key: string): Result<string> {
  const loaded = load(fileText)
  if (!loaded.ok) return loaded
  const t = loaded.value
  const pair = t?.map?.items.find((p) => isScalar(p.key) && String(p.key.value) === key)
  const keyRange = rangeOf(pair?.key)
  if (!t || !pair || !keyRange) return ok(fileText)

  const from = t.yaml.lastIndexOf('\n', keyRange[0] - 1) + 1
  const valueEnd = rangeOf(pair.value)?.[1] ?? keyRange[1]
  let to = t.yaml[valueEnd - 1] === '\n' ? valueEnd : t.yaml.indexOf('\n', valueEnd) + 1
  if (to <= 0) to = t.yaml.length
  return ok(splice(fileText, t.yamlStart + from, t.yamlStart + to, ''))
}
