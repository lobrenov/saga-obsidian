import { splitFrontmatter } from '../shared/frontmatter'

/** The first lines of a note's body as plain text (headings, code and embeds dropped, wikilinks as alias or target), at most `maxChars` long. */
export function toExcerpt(text: string, maxChars: number): string {
  const lines = splitFrontmatter(text)
    .body.split(/\r?\n/)
    .filter((line) => line.trim() !== '' && !/^\s*(#{1,6}\s|```|!\[\[)/.test(line))
  const plain = lines
    .join(' ')
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*`>~]|\^[\w-]+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= maxChars) return plain
  const cut = plain.slice(0, Math.max(0, maxChars - 1))
  const space = cut.lastIndexOf(' ')
  return `${(space > maxChars * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}
