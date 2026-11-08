export interface FrontmatterSpan {
  /** Offset of the opening `---`. */
  start: number
  /** Offset just after the closing line and its EOL (equals `bodyStart`). */
  end: number
  /** Offset of the first YAML line. */
  yamlStart: number
  /** Offset of the closing delimiter line. */
  yamlEnd: number
  /** The YAML source, `text.slice(yamlStart, yamlEnd)`. */
  text: string
}

export interface FrontmatterSplit {
  /** A byte-order mark, or empty. */
  bom: string
  /** The file's line ending: that of the opening line, else the first one found, else `\n`. */
  eol: '\n' | '\r\n'
  frontmatter: FrontmatterSpan | null
  bodyStart: number
  body: string
}

const OPEN = /---[ \t]*(\r?\n)/y
const CLOSE = /^(---|\.\.\.)[ \t]*$/

/** Splits a file into BOM, frontmatter block and body without altering any bytes (offsets index the original). */
export function splitFrontmatter(text: string): FrontmatterSplit {
  const start = text.startsWith('﻿') ? 1 : 0
  const bom = text.slice(0, start)
  const firstNl = text.indexOf('\n')
  let eol: '\n' | '\r\n' = firstNl > 0 && text[firstNl - 1] === '\r' ? '\r\n' : '\n'

  OPEN.lastIndex = start
  const open = OPEN.exec(text)
  if (open) {
    eol = open[1] === '\r\n' ? '\r\n' : '\n'
    const yamlStart = start + open[0].length
    for (let pos = yamlStart; pos < text.length; ) {
      const nl = text.indexOf('\n', pos)
      const lineEnd = nl < 0 ? text.length : nl
      if (CLOSE.test(text.slice(pos, lineEnd).replace(/\r$/, ''))) {
        const end = nl < 0 ? text.length : nl + 1
        return {
          bom,
          eol,
          frontmatter: { start, end, yamlStart, yamlEnd: pos, text: text.slice(yamlStart, pos) },
          bodyStart: end,
          body: text.slice(end)
        }
      }
      pos = lineEnd + 1
    }
  }
  return { bom, eol, frontmatter: null, bodyStart: start, body: text.slice(start) }
}
