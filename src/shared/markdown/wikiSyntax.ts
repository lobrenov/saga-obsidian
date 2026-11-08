import type { WikiLink } from '../wikilink'

export type WikiSpanName = 'WikiLinkMark' | 'WikiLinkTarget' | 'WikiLinkHeading' | 'WikiLinkBlock' | 'WikiLinkAlias'

export interface WikiSpan {
  name: WikiSpanName
  from: number
  to: number
}

export interface WikiParts {
  target: string
  heading?: string
  block?: string
  alias?: string
  /** Child spans, offsets relative to the start of the inner text. */
  spans: WikiSpan[]
}

/**
 * Parses the text between `[[` and `]]`: `target#heading#h2|alias`, `target#^block|alias`.
 * `\|` (as written inside tables) separates the alias like `|`.
 */
export function parseWikiInner(inner: string): WikiParts {
  const spans: WikiSpan[] = []
  const parts: WikiParts = { target: '', spans }

  const bar = inner.indexOf('|')
  const leftEnd = bar < 0 ? inner.length : inner[bar - 1] === '\\' ? bar - 1 : bar
  const hash = inner.indexOf('#')
  const targetEnd = hash >= 0 && hash < leftEnd ? hash : leftEnd

  const raw = inner.slice(0, targetEnd)
  const lead = raw.length - raw.trimStart().length
  parts.target = raw.trim()
  spans.push({ name: 'WikiLinkTarget', from: lead, to: lead + parts.target.length })

  if (targetEnd < leftEnd) {
    const after = targetEnd + 1
    if (inner[after] === '^' && after + 1 < leftEnd) {
      spans.push({ name: 'WikiLinkMark', from: targetEnd, to: after + 1 })
      spans.push({ name: 'WikiLinkBlock', from: after + 1, to: leftEnd })
      parts.block = inner.slice(after + 1, leftEnd)
    } else {
      spans.push({ name: 'WikiLinkMark', from: targetEnd, to: after })
      if (after < leftEnd) {
        spans.push({ name: 'WikiLinkHeading', from: after, to: leftEnd })
        parts.heading = inner.slice(after, leftEnd)
      }
    }
  }
  if (bar >= 0) {
    spans.push({ name: 'WikiLinkMark', from: leftEnd, to: bar + 1 })
    spans.push({ name: 'WikiLinkAlias', from: bar + 1, to: inner.length })
    parts.alias = inner.slice(bar + 1)
  }
  return parts
}

/** The plain link value for parsed parts. */
export function toWikiLink(parts: WikiParts, embed: boolean): WikiLink {
  const link: WikiLink = { target: parts.target, embed }
  if (parts.heading !== undefined) link.heading = parts.heading
  if (parts.block !== undefined) link.block = parts.block
  if (parts.alias !== undefined) link.alias = parts.alias
  return link
}
