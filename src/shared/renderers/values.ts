import type { WikiLink } from '../wikilink'
import type { FieldDef } from './fields'

/** `[[target#heading|alias]]` text of a link value (`!` first for embeds). */
export function formatWikiLink(link: WikiLink): string {
  const where = link.block !== undefined ? `#^${link.block}` : link.heading !== undefined ? `#${link.heading}` : ''
  return `${link.embed ? '!' : ''}[[${link.target}${where}${link.alias !== undefined ? `|${link.alias}` : ''}]]`
}

const isLink = (value: unknown): value is WikiLink => value !== null && typeof value === 'object' && !Array.isArray(value) && 'target' in value

/** The frontmatter value that stores a field value: links as `[[..]]` strings, everything else as is. */
export function toNoteValue(value: unknown): unknown {
  if (isLink(value)) return formatWikiLink(value)
  if (Array.isArray(value) && value.length > 0 && value.every(isLink)) return value.map(formatWikiLink)
  return value
}

const scalarText = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined

/**
 * The note value that fixes a value which failed its field's schema (string to list, bare name to `[[link]]`, number to text),
 * or undefined when there is no safe conversion.
 */
export function convertRaw(field: FieldDef, raw: unknown): unknown {
  switch (field.kind) {
    case 'text':
      if (Array.isArray(raw)) return raw.every((item) => scalarText(item) !== undefined) ? raw.map(scalarText).join(', ') : undefined
      return scalarText(raw)
    case 'list': {
      if (Array.isArray(raw)) return raw.every((item) => scalarText(item) !== undefined) ? raw.map(scalarText) : undefined
      const text = scalarText(raw)
      return text === undefined || text.trim() === '' ? undefined : [text.trim()]
    }
    case 'links': {
      const wrap = (item: unknown): string | undefined => {
        const text = scalarText(item)?.trim()
        return text ? (/^!?\[\[.*\]\]$/.test(text) ? text : `[[${text}]]`) : undefined
      }
      const items = Array.isArray(raw) ? raw.map(wrap) : [wrap(raw)]
      return items.length > 0 && items.every((item) => item !== undefined) ? items : undefined
    }
    case 'link':
    case 'image': {
      const text = scalarText(raw)?.trim()
      return text ? `[[${text.replace(/^\[+|\]+$/g, '')}]]` : undefined
    }
    case 'date':
      return undefined
    case 'choice': {
      const text = scalarText(raw)?.trim().toLowerCase()
      return field.options.find((option) => option.toLowerCase() === text)
    }
  }
}
