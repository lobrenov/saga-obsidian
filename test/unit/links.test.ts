import { ensureSyntaxTree, StreamLanguage } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { tags } from '@lezer/highlight'
import { describe, expect, it } from 'vitest'
import { createLinkRenderers } from '../../src/links/renderers'
import { wikilinksIn } from '../../src/links/syntax'
import { CONFIG_PATH, createConfigStore } from '../../src/obsidian/vault'
import { FakeApp } from '../fakes/obsidian'

/** Tokens named as Obsidian's Markdown mode names them, for `[[` / `![[`, the inner text, `]]`, and `[^`. */
const classes = ['formatting', 'formatting-link', 'formatting-link-start', 'formatting-link-end', 'formatting-embed', 'hmd-internal-link']
const markdown = StreamLanguage.define<null>({
  startState: () => null,
  tokenTable: Object.fromEntries(classes.map((name) => [name, tags.link])),
  token(stream) {
    if (stream.match('![[')) return 'formatting-link formatting-link-start formatting-embed'
    if (stream.match('[[')) return 'formatting-link formatting-link-start'
    if (stream.match('[^')) return 'formatting formatting-link formatting-link-start'
    if (stream.match(']]')) return 'formatting-link formatting-link-end'
    if (stream.match(/^[^[\]!]+/)) return 'hmd-internal-link'
    stream.next()
    return null
  }
})

const linksOf = (doc: string) => {
  const state = EditorState.create({ doc, extensions: markdown })
  ensureSyntaxTree(state, doc.length, 1000)
  return wikilinksIn(state, 0, doc.length)
}

describe('wikilinksIn', () => {
  it('finds each wikilink start and target, without embeds', () => {
    expect(linksOf('See [[Ada]] and [[Places/Waterdeep#Docks|the docks]], not ![[map.png]].')).toEqual([
      { from: 4, target: 'Ada' },
      { from: 16, target: 'Places/Waterdeep' }
    ])
  })

  it('skips empty links and non-wikilink link starts', () => {
    expect(linksOf('[^1] [[]] [[#Heading]]')).toEqual([])
  })
})

describe('createLinkRenderers', () => {
  async function setup() {
    const app = new FakeApp()
    app.setRaw(CONFIG_PATH, 'renderers:\n  location:\n    types: [place]\n')
    const ada = app.addFile('Characters/Ada.md', '---\ntype: character\n---\n')
    app.addFile('Places/Waterdeep.md', '---\ntype: place\n---\n')
    app.addFile('Notes/Plain.md', 'text')
    const config = await createConfigStore(app.asApp(), app.owner())
    return { app, ada, renderers: createLinkRenderers(app.asApp(), config) }
  }

  it('gives the linked note’s renderer, null for documents and unresolved links', async () => {
    const { renderers } = await setup()
    expect(renderers.of('Ada', 'Notes/Plain.md')).toBe('character')
    expect(renderers.of('Waterdeep', 'Notes/Plain.md')).toBe('location')
    expect(renderers.of('Plain', 'Notes/Plain.md')).toBeNull()
    expect(renderers.of('Nowhere', 'Notes/Plain.md')).toBeNull()
  })

  it('reports a change only for a seen note whose renderer changed', async () => {
    const { app, ada, renderers } = await setup()
    expect(renderers.changed(ada)).toBe(false)
    renderers.of('Ada', 'Notes/Plain.md')
    app.addFile('Characters/Ada.md', '---\ntype: character\nrole: x\n---\n')
    expect(renderers.changed(ada)).toBe(false)
    app.addFile('Characters/Ada.md', '---\ntype: place\n---\n')
    expect(renderers.changed(ada)).toBe(true)
    expect(renderers.changed(ada)).toBe(false)
  })
})
