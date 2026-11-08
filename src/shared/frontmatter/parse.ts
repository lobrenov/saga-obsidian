import type { Document } from 'yaml'
import { isMap, parseDocument } from 'yaml'
import type { FrontmatterSplit } from './split'
import { splitFrontmatter } from './split'

export interface FrontmatterError {
  message: string
  /** Offsets into the full file text. */
  from: number
  to: number
}

export interface ParsedFrontmatter {
  data: Record<string, unknown>
  errors: FrontmatterError[]
  /** The yaml document (offsets relative to the YAML text), null without frontmatter. */
  doc: Document.Parsed | null
  split: FrontmatterSplit
}

/** Parses the frontmatter of a whole file. Invalid YAML is reported in `errors`, never thrown. */
export function parseFrontmatter(fileText: string): ParsedFrontmatter {
  const split = splitFrontmatter(fileText)
  const fm = split.frontmatter
  if (!fm) return { data: {}, errors: [], doc: null, split }

  const doc = parseDocument(fm.text, { keepSourceTokens: true })
  const errors: FrontmatterError[] = doc.errors.map((e) => ({
    message: e.message,
    from: fm.yamlStart + e.pos[0],
    to: fm.yamlStart + e.pos[1]
  }))
  let data: Record<string, unknown> = {}
  if (errors.length === 0) {
    if (doc.contents === null || (doc.contents && isMap(doc.contents))) {
      const js: unknown = doc.toJS()
      if (js && typeof js === 'object') data = js as Record<string, unknown>
    } else {
      errors.push({ message: 'Frontmatter must be a mapping', from: fm.yamlStart, to: fm.yamlEnd })
    }
  }
  return { data, errors, doc, split }
}
