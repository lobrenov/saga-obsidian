import { z } from 'zod'
import { parseWikiInner, toWikiLink } from './markdown/wikiSyntax'

export interface WikiLink {
  target: string
  heading?: string
  block?: string
  alias?: string
  embed: boolean
}

const WIKILINK = /^(!?)\[\[([^[\]\n]*)\]\]$/

/** Parses a single `[[target#heading|alias]]` / `![[target#^block]]` string; null if it is not one. */
export function parseWikiLink(text: string): WikiLink | null {
  const match = WIKILINK.exec(text.trim())
  if (!match) return null
  const link = toWikiLink(parseWikiInner(match[2] ?? ''), match[1] === '!')
  return link.target ? link : null
}

export const wikiLinkSchema = z.string().transform((text, ctx): WikiLink => {
  const link = parseWikiLink(text)
  if (!link) {
    ctx.issues.push({ code: 'custom', message: 'Not a wikilink', input: text })
    return z.NEVER
  }
  return link
})
