import { ensureSyntaxTree, StreamLanguage } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { tags } from '@lezer/highlight'
import { describe, expect, it } from 'vitest'
import { createLinkRenderers, linkMarks, NO_MARKS, type LinkTarget } from '../../src/links/renderers'
import { wikilinksIn } from '../../src/links/syntax'
import { createPrefsStore, type Prefs } from '../../src/obsidian/prefs'
import { CONFIG_PATH, createConfigStore } from '../../src/obsidian/vault'
import type { Plugin } from 'obsidian'
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
      { from: 4, to: 11, target: 'Ada' },
      { from: 16, to: 52, target: 'Places/Waterdeep' }
    ])
  })

  it('skips empty links and non-wikilink link starts', () => {
    expect(linksOf('[^1] [[]] [[#Heading]]')).toEqual([])
  })
})

describe('createLinkRenderers', () => {
  async function setup() {
    const app = new FakeApp()
    app.setRaw(CONFIG_PATH, 'renderers:\n  location:\n    types: [place]\n    pin: { color: sea }\n')
    const ada = app.addFile('Characters/Ada.md', '---\ntype: character\ntitle: " Mathematician "\n---\n')
    app.addFile('Characters/Bob.md', '---\ntype: character\ntitle: ""\n---\n')
    app.addFile('Places/Waterdeep.md', '---\ntype: place\ntitle: Ignored\n---\n')
    app.addFile('Places/Docks.md', '---\ntype: place\nmap-pins:\n  - { map: "[[Coast]]", x: 1, y: 2, color: plum, icon: anchor }\n  - { map: "[[Other]]", x: 1, y: 2, color: moss }\n---\n')
    app.addFile('Places/Camp.md', '---\ntype: place\nmap-pins:\n  - { map: "[[Coast]]", x: 1, y: 2, style: camp }\n---\n')
    app.addFile('Notes/Plain.md', 'text')
    const config = await createConfigStore(app.asApp(), app.owner())
    return { app, ada, renderers: createLinkRenderers(app.asApp(), config) }
  }

  it('gives the linked note’s renderer, look and character title, null for documents and unresolved links', async () => {
    const { renderers } = await setup()
    expect(renderers.of('Ada', 'Notes/Plain.md')).toEqual({ renderer: 'character', look: { shape: 'pin', color: 'crimson', icon: 'user' }, title: 'Mathematician' })
    expect(renderers.of('Bob', 'Notes/Plain.md')?.title).toBeNull()
    expect(renderers.of('Waterdeep', 'Notes/Plain.md')).toEqual({ renderer: 'location', look: { shape: 'pin', color: 'sea', icon: 'castle' }, title: null })
    expect(renderers.of('Plain', 'Notes/Plain.md')).toBeNull()
    expect(renderers.of('Nowhere', 'Notes/Plain.md')).toBeNull()
  })

  it('takes the look from the note’s first pin over the renderer’s', async () => {
    const { renderers } = await setup()
    expect(renderers.of('Docks', 'Notes/Plain.md')?.look).toEqual({ shape: 'pin', color: 'plum', icon: 'anchor' })
    expect(renderers.of('Camp', 'Notes/Plain.md')?.look).toEqual({ shape: 'pin', color: 'sea', icon: 'tent' })
  })

  it('reads the title from a remapped key', async () => {
    const app = new FakeApp()
    app.setRaw(CONFIG_PATH, 'renderers:\n  character:\n    keys: { title: role }\n')
    app.addFile('Ada.md', '---\ntype: character\ntitle: Old\nrole: Captain\n---\n')
    const renderers = createLinkRenderers(app.asApp(), await createConfigStore(app.asApp(), app.owner()))
    expect(renderers.of('Ada', 'Ada.md')?.title).toBe('Captain')
  })

  it('reports a change only for a seen note whose renderer changed', async () => {
    const { app, ada, renderers } = await setup()
    expect(renderers.changed(ada)).toBe(false)
    renderers.of('Ada', 'Notes/Plain.md')
    app.addFile('Characters/Ada.md', '---\ntype: character\ntitle: " Mathematician "\nrole: x\n---\n')
    expect(renderers.changed(ada)).toBe(false)
    app.addFile('Characters/Ada.md', '---\ntype: character\ntitle: Countess\n---\n')
    expect(renderers.changed(ada)).toBe(true)
    app.addFile('Characters/Ada.md', '---\ntype: character\ntitle: Countess\nmap-pins:\n  - { map: "[[Coast]]", x: 1, y: 2, color: plum }\n---\n')
    expect(renderers.changed(ada)).toBe(true)
    app.addFile('Characters/Ada.md', '---\ntype: place\n---\n')
    expect(renderers.changed(ada)).toBe(true)
    expect(renderers.changed(ada)).toBe(false)
  })
})

describe('linkMarks', () => {
  const target: LinkTarget = { renderer: 'character', look: { shape: 'pin', color: 'plum', icon: 'anchor' }, title: 'Mathematician' }
  const prefs: Prefs = { pinLabels: 'always', linkIcons: true, linkIconLook: 'renderer', linkTitles: true }

  it('gives the renderer’s icon, or the pin look’s icon and colour', () => {
    expect(linkMarks(target, prefs)).toEqual({ icon: { renderer: 'character', icon: 'user', color: null }, title: 'Mathematician' })
    expect(linkMarks(target, { ...prefs, linkIconLook: 'pin' }).icon).toEqual({ renderer: 'character', icon: 'anchor', color: 'plum' })
  })

  it('leaves out what its pref turns off', () => {
    expect(linkMarks(target, { ...prefs, linkIcons: false })).toEqual({ icon: null, title: 'Mathematician' })
    expect(linkMarks(target, { ...prefs, linkTitles: false }).title).toBeNull()
    expect(linkMarks(null, prefs)).toBe(NO_MARKS)
  })
})

describe('createPrefsStore', () => {
  const store = (saved: unknown) => createPrefsStore({ loadData: () => Promise.resolve(saved), saveData: () => Promise.resolve() } as unknown as Plugin)

  it('defaults the link prefs and keeps a saved linkIcons', async () => {
    expect((await store(null)).get()).toEqual({ pinLabels: 'always', linkIcons: false, linkIconLook: 'renderer', linkTitles: false })
    expect((await store({ linkIcons: true })).get()).toMatchObject({ linkIcons: true, linkIconLook: 'renderer', linkTitles: false })
    expect((await store({ linkIconLook: 'pin', linkTitles: true })).get()).toMatchObject({ linkIconLook: 'pin', linkTitles: true })
  })
})
