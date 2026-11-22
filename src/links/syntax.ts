import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { parseWikiInner } from '../shared/markdown/wikiSyntax'

export interface WikilinkAt {
  /** Position of the link's `[[`. */
  from: number
  /** Position after the link's `]]`. */
  to: number
  target: string
}

/** The wikilinks (not embeds) overlapping `from`–`to` in Obsidian's Markdown syntax tree, whose node names are `_`-joined token classes. */
export function wikilinksIn(state: EditorState, from: number, to: number): WikilinkAt[] {
  const links: WikilinkAt[] = []
  let start = -1
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      const classes = node.name.split('_')
      if (classes.includes('formatting-link-start')) {
        start = !classes.includes('formatting-embed') && state.sliceDoc(node.from, node.from + 2) === '[[' ? node.from : -1
      } else if (start >= 0 && classes.includes('formatting-link-end')) {
        const { target } = parseWikiInner(state.sliceDoc(start + 2, node.from))
        if (target) links.push({ from: start, to: node.to, target })
        start = -1
      }
    }
  })
  return links
}
