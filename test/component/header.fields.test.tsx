import { expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { FieldView } from '../../src/header/FieldView'
import { HeaderCtx } from '../../src/header/env'
import { readFrontmatter } from '../../src/shared/schemas/frontmatter'
import { testEnv, HeaderFakeApp } from '../fakes/header'
import { ADA, DEFAULT_CONFIG, FILES, renderHeader } from './header.support'

const ada = 'Characters/Ada Lovelace.md'
const settle = { timeout: 3000 }

test('the text editor writes only its key, on blur', async () => {
  const { screen, text, app } = await renderHeader(ada, ADA)
  const role = screen.getByRole('textbox', { name: 'Role' })
  await expect.element(role).toHaveValue('Mathematician')
  await role.fill('Port warden')
  expect(app.processed).toHaveLength(0)
  ;(role.element() as HTMLElement).blur()
  await vi.waitFor(() => expect(text()).toBe(ADA.replace('role: Mathematician', 'role: Port warden')))
})

test('typing writes once after a pause, not per keystroke, and the cursor stays put when the cache catches up', async () => {
  const { screen, text, app } = await renderHeader(ada, ADA)
  const role = screen.getByRole('textbox', { name: 'Role' })
  await role.fill('Alpha')
  await userEvent.keyboard('Be')
  expect(app.processed).toHaveLength(0)
  await vi.waitFor(() => expect(text()).toContain('role: AlphaBe'), settle)
  await userEvent.keyboard('ta')
  const area = role.element() as HTMLTextAreaElement
  expect(area.value).toBe('AlphaBeta')
  expect(area.selectionStart).toBe(9)
  expect(app.processed).toHaveLength(1)
  await vi.waitFor(() => expect(text()).toContain('role: AlphaBeta'), settle)
})

test('clearing a text field removes only its key', async () => {
  const { screen, text } = await renderHeader(ada, ADA)
  const role = screen.getByRole('textbox', { name: 'Role' })
  await role.fill('')
  ;(role.element() as HTMLElement).blur()
  await vi.waitFor(() => expect(text()).toBe(ADA.replace('role: Mathematician\n', '')))
  await expect.element(screen.getByRole('textbox', { name: 'Role' })).toHaveAttribute('placeholder', 'Add role…')
})

test('Enter commits and Escape reverts a text edit', async () => {
  const { screen, text, app } = await renderHeader(ada, ADA)
  const role = screen.getByRole('textbox', { name: 'Role' })
  await role.fill('Typed')
  await userEvent.keyboard('{Enter}')
  await vi.waitFor(() => expect(text()).toBe(ADA.replace('role: Mathematician', 'role: Typed')))
  await role.fill('Discarded')
  await userEvent.keyboard('{Escape}')
  await expect.element(role).toHaveValue('Typed')
  expect(app.processed).toHaveLength(1)
})

test('the text editor grows with its content', async () => {
  const { screen } = await renderHeader(ada, ADA)
  const role = screen.getByRole('textbox', { name: 'Role' })
  const before = (role.element() as HTMLElement).getBoundingClientRect().height
  await role.fill('A very long role that keeps going and going '.repeat(12))
  await vi.waitFor(() => expect((role.element() as HTMLElement).getBoundingClientRect().height).toBeGreaterThan(before))
})

test('the choice editor selects, and clearing removes only its key', async () => {
  const { screen, text } = await renderHeader(ada, ADA)
  const status = screen.getByRole('combobox', { name: 'Status' })
  await status.selectOptions('dead')
  await vi.waitFor(() => expect(text()).toBe(ADA.replace('status: alive', 'status: dead')))
  await status.selectOptions('')
  await vi.waitFor(() => expect(text()).toBe(ADA.replace('status: alive\n', '')))
})

test('a link opens its note, in a new tab on a modifier-click, and previews on hover', async () => {
  const { screen, app, hovered } = await renderHeader(ada, ADA)
  const link = screen.getByRole('button', { name: 'Waterdeep', exact: true })
  await link.hover()
  await vi.waitFor(() => expect(hovered).toContain('Waterdeep'))
  await link.click()
  await link.click({ modifiers: ['ControlOrMeta'] })
  expect(app.opened.map((o) => [o.linktext, o.sourcePath, o.newLeaf])).toEqual([
    ['Waterdeep', ada, false],
    ['Waterdeep', ada, true]
  ])
})

test('the link editor writes the picked note as [[Target]] and nothing else', async () => {
  const { screen, text, suggesters } = await renderHeader(ada, ADA)
  await screen.getByRole('button', { name: 'Edit Location' }).click()
  const input = screen.getByRole('textbox', { name: 'Location' }).element() as HTMLInputElement
  const suggester = suggesters.find((s) => s.input === input)
  expect([suggester?.kind, suggester?.from()]).toEqual(['note', ada])
  suggester?.pick('Bob')
  await vi.waitFor(() => expect(text()).toBe(ADA.replace('location: "[[Waterdeep]]"', 'location: "[[Bob]]"')))
  await vi.waitFor(() => expect(input.isConnected).toBe(false))
  await expect.element(screen.getByRole('button', { name: 'Bob', exact: true })).toBeVisible()
})

test('an empty link field takes typed text', async () => {
  const { screen, text } = await renderHeader(ada, ADA)
  const affiliation = screen.getByRole('textbox', { name: 'Affiliation' })
  await affiliation.fill('The Gull King')
  await userEvent.keyboard('{Enter}')
  await vi.waitFor(() => expect(text()).toBe(ADA.replace('status: alive', 'status: alive\naffiliation: "[[The Gull King]]"')))
})

test('clearing a link removes only its key', async () => {
  const { screen, text } = await renderHeader(ada, ADA)
  await screen.getByRole('button', { name: 'Edit Location' }).click()
  const input = screen.getByRole('textbox', { name: 'Location' })
  await input.fill('')
  await userEvent.keyboard('{Enter}')
  await vi.waitFor(() => expect(text()).toBe(ADA.replace('location: "[[Waterdeep]]"\n', '')))
})

const GUILD = '---\ntype: faction\nallies:\n  - "[[Bob]]"\n---\n'

test('the links editor adds a picked note, ignores a duplicate and removes a chip', async () => {
  const { screen, text, suggesters } = await renderHeader('Factions/Harbor Guild.md', GUILD)
  const allies = () => suggesters.find((s) => s.input === (screen.getByRole('textbox', { name: 'Allies' }).element() as HTMLInputElement))
  allies()?.pick('Waterdeep')
  await vi.waitFor(() => expect(text()).toBe('---\ntype: faction\nallies:\n  - "[[Bob]]"\n  - "[[Waterdeep]]"\n---\n'))
  allies()?.pick('bob')
  await userEvent.keyboard('{Escape}')
  expect(text()).toContain('"[[Waterdeep]]"')
  expect(text().match(/\[\[Bob\]\]/g)).toHaveLength(1)
  await screen.getByRole('button', { name: 'Remove Bob' }).click()
  await vi.waitFor(() => expect(text()).toBe('---\ntype: faction\nallies:\n  - "[[Waterdeep]]"\n---\n'))
})

test('the image editor shows a preview, picks an image and removes it', async () => {
  const { screen, text, suggesters } = await renderHeader('Places/Docks.md', '---\ntype: location\nkind: Harbour\n---\n')
  expect(suggesters.map((s) => s.kind)).toContain('image')
  suggesters.find((s) => s.kind === 'image')?.pick('coast.jpg')
  await vi.waitFor(() => expect(text()).toBe('---\ntype: location\nkind: Harbour\nimage: "[[coast.jpg]]"\n---\n'))
  await expect.element(screen.getByRole('img', { name: 'Image' })).toBeVisible()
  expect(screen.getByRole('img', { name: 'Image' }).element().getAttribute('src')).toContain('coast.jpg')
  await screen.getByRole('button', { name: 'Remove image' }).click()
  await vi.waitFor(() => expect(text()).toBe('---\ntype: location\nkind: Harbour\n---\n'))
})

test('an image that does not resolve is flagged', async () => {
  const { screen } = await renderHeader('Places/Docks.md', '---\ntype: location\nimage: "[[gone.png]]"\n---\n')
  await expect.element(screen.getByText('gone.png was not found in the vault.')).toBeVisible()
})

test('Convert fixes a value that fails its schema and writes only that key', async () => {
  const source = ADA.replace('location: "[[Waterdeep]]"', 'location: Waterdeep')
  const { screen, text } = await renderHeader(ada, source)
  await expect.element(screen.getByText('Not a wikilink')).toBeVisible()
  await screen.getByRole('button', { name: 'Convert Location' }).click()
  await vi.waitFor(() => expect(text()).toBe(ADA))
})

test('renamed keys write the mapped key', async () => {
  const config = { typeKey: 'type', renderers: { character: { types: ['NPC'], keys: { role: 'job', location: 'home' }, templates: [] } } }
  const source = '---\ntype: NPC\njob: Smith\nhome: "[[Waterdeep]]"\nrole: ignored\n---\n'
  const { screen, text } = await renderHeader(ada, source, { config })
  const role = screen.getByRole('textbox', { name: 'Role' })
  await expect.element(role).toHaveValue('Smith')
  await role.fill('Mason')
  ;(role.element() as HTMLElement).blur()
  await vi.waitFor(() => expect(text()).toBe(source.replace('job: Smith', 'job: Mason')))
  await screen.getByRole('combobox', { name: 'Status' }).selectOptions('missing')
  await vi.waitFor(() => expect(text()).toBe(source.replace('job: Smith', 'job: Mason').replace('role: ignored', 'role: ignored\nstatus: missing')))
})

test('the type selector offers the renderer types and writes the type key', async () => {
  const config = { typeKey: 'kind-of', renderers: { character: { types: ['NPC', 'hero'], keys: {}, templates: [] } } }
  const source = '---\nkind-of: NPC\nrole: R\nlocation: "[[Waterdeep]]"\n---\n'
  const { screen, text } = await renderHeader(ada, source, { config })
  const type = screen.getByRole('combobox', { name: 'Type' })
  await expect.element(type).toHaveValue('NPC')
  expect(type.element().querySelectorAll('option')).toHaveLength(2)
  await type.selectOptions('hero')
  await vi.waitFor(() => expect(text()).toBe(source.replace('kind-of: NPC', 'kind-of: hero')))
})

test('changing the type to another renderer redraws the header', async () => {
  const { screen, text } = await renderHeader(ada, ADA, { config: { typeKey: 'type', renderers: { character: { types: ['character', 'location'], keys: {}, templates: [] } } } })
  await screen.getByRole('combobox', { name: 'Type' }).selectOptions('location')
  await vi.waitFor(() => expect(text()).toContain('type: location'))
})

test('the list editor adds and removes items', async () => {
  const app = new HeaderFakeApp()
  for (const [p, t] of Object.entries(FILES)) app.addFile(p, t)
  const file = app.addFile('Notes/N.md', '---\naliases: [a]\n---\n')
  const { env } = testEnv(app)
  const def = { kind: 'list', key: 'aliases', required: false, label: 'Aliases' } as const
  const layer = readFrontmatter({ fields: { aliases: def } }, { aliases: ['a'] }).fields.aliases
  const screen = await render(
    <HeaderCtx.Provider value={{ env, file, config: DEFAULT_CONFIG }}>
      <FieldView def={def} noteKey="aliases" raw={['a']} layer={layer} />
    </HeaderCtx.Provider>
  )
  await screen.getByRole('textbox', { name: 'Aliases' }).fill('b')
  await userEvent.keyboard('{Enter}')
  await vi.waitFor(() => expect(app.text('Notes/N.md')).toBe('---\naliases:\n  - a\n  - b\n---\n'))
  await screen.getByRole('button', { name: 'Remove a' }).click()
  await vi.waitFor(() => expect(app.text('Notes/N.md')).toBe('---\naliases:\n  - b\n---\n'))
})

test('the title renames through the file manager; Escape cancels and bad names are refused', async () => {
  const { screen, app } = await renderHeader(ada, ADA)
  await screen.getByRole('button', { name: 'Ada Lovelace' }).click()
  const input = screen.getByRole('textbox', { name: 'Note name' })
  await input.fill('Ada Byron')
  await userEvent.keyboard('{Enter}')
  await vi.waitFor(() => expect(app.renamed).toEqual([{ from: ada, to: 'Characters/Ada Byron.md' }]))

  await screen.getByRole('button', { name: 'Ada Lovelace' }).click()
  await screen.getByRole('textbox', { name: 'Note name' }).fill('Bad/Name')
  await vi.waitFor(() => expect(screen.getByRole('alert').element().textContent).toMatch(/must not contain/))
  await userEvent.keyboard('{Escape}')
  await screen.getByRole('button', { name: 'Ada Lovelace' }).click()
  await screen.getByRole('textbox', { name: 'Note name' }).fill('Bob')
  await vi.waitFor(() => expect(screen.getByRole('alert').element().textContent).toMatch(/already exists/))
  await userEvent.keyboard('{Escape}')
  expect(app.renamed).toHaveLength(1)
})

test('successive list and links edits before the cache catches up all land', async () => {
  const { screen, text, suggesters } = await renderHeader('Factions/Harbor Guild.md', GUILD)
  const input = screen.getByRole('textbox', { name: 'Allies' }).element() as HTMLInputElement
  const allies = suggesters.find((s) => s.input === input)
  allies?.pick('Waterdeep')
  allies?.pick('Harbor Guild')
  await vi.waitFor(() => expect(text()).toBe('---\ntype: faction\nallies:\n  - "[[Bob]]"\n  - "[[Waterdeep]]"\n  - "[[Harbor Guild]]"\n---\n'))
})
