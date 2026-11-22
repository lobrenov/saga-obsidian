import { ensureSyntaxTree, StreamLanguage } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { tags } from '@lezer/highlight'
import { describe, expect, it } from 'vitest'
import { createLinkRenderers, linkMarks, NO_MARKS, type LinkTarget } from '../../src/links/renderers'
import { wikilinksIn } from '../../src/links/syntax'
import { createPrefsStore, type Prefs } from '../../src/obsidian/prefs'
import { CONFIG_PATH, createConfigStore } from '../../src/obsidian/vault'
import type { Plugin } from 'obsidian'
import { FakeApp, Plugin as FakePlugin } from '../fakes/obsidian'

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
    app.addFile('Maps/Coast.md', '---\ntype: map\n---\n')
    app.addFile('Maps/Other.md', '---\ntype: map\n---\n')
    const config = await createConfigStore(app.asApp(), app.owner())
    return { app, ada, renderers: createLinkRenderers(app.asApp(), config) }
  }

  it('gives the linked note’s renderer, look and character title, null for documents and unresolved links', async () => {
    const { renderers } = await setup()
    expect(renderers.of('Ada', 'Notes/Plain.md')).toEqual({ renderer: 'character', pins: {}, title: 'Mathematician' })
    expect(renderers.of('Bob', 'Notes/Plain.md')?.title).toBeNull()
    expect(renderers.of('Waterdeep', 'Notes/Plain.md')).toEqual({ renderer: 'location', pins: {}, title: null })
    expect(renderers.of('Plain', 'Notes/Plain.md')).toBeNull()
    expect(renderers.of('Nowhere', 'Notes/Plain.md')).toBeNull()
  })

  it('gives a file’s target, documents included', async () => {
    const { app, ada, renderers } = await setup()
    expect(renderers.ofFile(ada)).toEqual(renderers.of('Ada', 'Notes/Plain.md'))
    expect(renderers.ofFile(app.asApp().vault.getFileByPath('Notes/Plain.md')!)).toEqual({ renderer: 'document', pins: {}, title: null })
  })

  it('gives the look of the note’s first pin on each map it resolves to, its own keys over the renderer’s', async () => {
    const { app, renderers } = await setup()
    expect(renderers.of('Docks', 'Notes/Plain.md')?.pins).toEqual({
      'Maps/Coast.md': { shape: 'pin', color: 'plum', icon: 'anchor' },
      'Maps/Other.md': { shape: 'pin', color: 'moss', icon: 'castle' }
    })
    expect(renderers.of('Camp', 'Notes/Plain.md')?.pins).toEqual({ 'Maps/Coast.md': { shape: 'pin', color: 'sea', icon: 'tent' } })
    app.addFile('Places/Camp.md', '---\ntype: place\nmap-pins:\n  - { map: "[[Nowhere]]", x: 1, y: 2 }\n  - { map: "[[Coast]]", x: 1, y: 2, icon: tent }\n  - { map: "[[Coast]]", x: 3, y: 4, icon: skull }\n---\n')
    expect(renderers.of('Camp', 'Notes/Plain.md')?.pins).toEqual({ 'Maps/Coast.md': { shape: 'pin', color: 'sea', icon: 'tent' } })
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
  const target: LinkTarget = { renderer: 'character', pins: { 'Maps/Coast.md': { shape: 'pin', color: 'plum', icon: 'anchor' } }, title: 'Mathematician' }
  const prefs: Prefs = { pinLabels: 'always', linkIcons: true, linkIconLook: 'renderer', linkTitles: true, fileIcons: false, fileIconsUntyped: true }

  it('gives the renderer’s icon, or the icon and colour of the note’s pin on the chosen map, else the renderer’s', () => {
    expect(linkMarks(target, prefs)).toEqual({ icon: { renderer: 'character', icon: 'user', color: null }, title: 'Mathematician' })
    expect(linkMarks(target, { ...prefs, linkIconLook: 'Maps/Coast.md' }).icon).toEqual({ renderer: 'character', icon: 'anchor', color: 'plum' })
    expect(linkMarks(target, { ...prefs, linkIconLook: 'Maps/Other.md' }).icon).toEqual({ renderer: 'character', icon: 'user', color: null })
  })

  it('leaves out what its pref turns off', () => {
    expect(linkMarks(target, { ...prefs, linkIcons: false })).toEqual({ icon: null, title: 'Mathematician' })
    expect(linkMarks(target, { ...prefs, linkTitles: false }).title).toBeNull()
    expect(linkMarks(null, prefs)).toBe(NO_MARKS)
  })
})

describe('createPrefsStore', () => {
  const store = (saved: unknown, app = new FakeApp()) =>
    createPrefsStore(Object.assign(new FakePlugin(app.asApp(), { id: 'saga' }), { loadData: () => Promise.resolve(saved), saveData: () => Promise.resolve() }) as unknown as Plugin)

  it('defaults the link and file icon prefs and keeps saved ones', async () => {
    expect((await store(null)).get()).toEqual({ pinLabels: 'always', linkIcons: false, linkIconLook: 'renderer', linkTitles: false, fileIcons: false, fileIconsUntyped: true })
    expect((await store({ fileIcons: true, fileIconsUntyped: false })).get()).toMatchObject({ fileIcons: true, fileIconsUntyped: false })
    expect((await store({ linkIcons: true })).get()).toMatchObject({ linkIcons: true, linkIconLook: 'renderer', linkTitles: false })
    expect((await store({ linkIconLook: 'Maps/Coast.md', linkTitles: true })).get()).toMatchObject({ linkIconLook: 'Maps/Coast.md', linkTitles: true })
    expect((await store({ linkIconLook: 'pin' })).get().linkIconLook).toBe('renderer')
  })

  it('follows a rename of the icon look’s map, or of a folder holding it', async () => {
    const app = new FakeApp()
    const prefs = await store({ linkIconLook: 'Maps/Coast.md' }, app)
    app.vault.trigger('rename', { path: 'Maps/Other.md' }, 'Maps/Elsewhere.md')
    expect(prefs.get().linkIconLook).toBe('Maps/Coast.md')
    app.vault.trigger('rename', { path: 'Maps/Shore.md' }, 'Maps/Coast.md')
    expect(prefs.get().linkIconLook).toBe('Maps/Shore.md')
    app.vault.trigger('rename', { path: 'Atlas' }, 'Maps')
    expect(prefs.get().linkIconLook).toBe('Atlas/Shore.md')
    app.vault.trigger('rename', { path: 'Atlas2/Shore.md' }, 'Atlas/Shore.md')
    app.vault.trigger('rename', { path: 'Atl' }, 'Atlas2/Shor')
    expect(prefs.get().linkIconLook).toBe('Atlas2/Shore.md')
  })
})
