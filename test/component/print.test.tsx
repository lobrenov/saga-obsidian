import { afterEach, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { PrintNote } from '../../src/print/PrintNote'
import { frontmatterOf } from '../../src/obsidian/vault'
import type { Config } from '../../src/shared/schemas/config'
import { HeaderFakeApp } from '../fakes/header'
import { DEFAULT_CONFIG, FILES } from './header.support'

afterEach(() => document.body.replaceChildren())

/** Renders the print view of the note over a fake vault of `FILES`. */
async function renderPrint(path: string, text: string, options: { documentCard?: boolean; config?: Config } = {}) {
  const app = new HeaderFakeApp()
  for (const [p, t] of Object.entries(FILES)) app.addFile(p, t)
  const file = app.addFile(path, text)
  await render(
    <PrintNote
      app={app.asApp()}
      setIcon={(el, name) => {
        el.dataset.icon = name
      }}
      file={file}
      frontmatter={frontmatterOf(app.asApp(), file)}
      config={options.config ?? DEFAULT_CONFIG}
      documentCard={options.documentCard ?? true}
    />
  )
  return { app }
}

const fieldsOf = (): string[] => [...document.querySelectorAll('[data-field]')].map((el) => el.getAttribute('data-field') ?? '')
const guild: Config = { typeKey: 'type', renderers: { faction: { types: ['guild'], keys: {}, templates: [] }, item: { types: ['artifact'], keys: {}, templates: [] } } }

test('Character prints its portrait, name, epithet and facts as static text', async () => {
  const { app } = await renderPrint('Characters/Ada Lovelace.md', '---\ntype: character\nportrait: "[[portrait.png]]"\ntitle: Countess\nlocation: "[[Waterdeep]]"\nstatus: alive\n---\n')
  expect(document.querySelector('.saga-print .saga-header[data-renderer="character"]')).not.toBeNull()
  expect(document.querySelector('.saga-header-badge')?.textContent).toBe('Character')
  expect(document.querySelector('.saga-header-title')?.textContent).toBe('Ada Lovelace')
  expect(fieldsOf()).toEqual(['portrait', 'title', 'location', 'status'])
  expect(document.querySelector('.saga-header-portrait img')?.getAttribute('src')).toBe(app.vault.getResourcePath(app.vault.getFileByPath('Attachments/portrait.png') as never))
  expect(document.querySelector('[data-field="title"] .saga-header-control')?.textContent).toBe('Countess')
  expect(document.querySelector('[data-field="status"] .saga-header-control')?.textContent).toBe('alive')
})

test('Location prints kind and region, and no image in the card', async () => {
  await renderPrint('Places/Docks.md', '---\ntype: location\nimage: "[[coast.jpg]]"\nkind: Harbour\nregion: "[[Waterdeep]]"\n---\n')
  expect(fieldsOf()).toEqual(['kind', 'region'])
  expect(document.querySelector('.saga-header-body img')).toBeNull()
  expect(document.querySelectorAll('.saga-banner img')).toHaveLength(1)
})

test('Faction prints its emblem, leader, base and allies', async () => {
  await renderPrint('Factions/Harbor Guild.md', '---\ntype: guild\nemblem: "[[portrait.png]]"\nleader: "[[Bob]]"\nbase: "[[Waterdeep]]"\nallies:\n  - "[[Bob]]"\n  - "[[Nobody]]"\n---\n', { config: guild })
  expect(fieldsOf()).toEqual(['emblem', 'leader', 'base', 'allies'])
  expect(document.querySelector('.saga-header-emblem img')).not.toBeNull()
  expect(document.querySelectorAll('[data-field="allies"] .saga-header-chip')).toHaveLength(2)
})

test('Item prints its fields', async () => {
  await renderPrint('Items/Moonblade.md', '---\ntype: artifact\nrarity: legendary\nholder: "[[Bob]]"\nowner: "[[Harbor Guild]]"\n---\n', { config: guild })
  expect(fieldsOf()).toEqual(['rarity', 'owner'])
})

test('hidden fields are left out of the print', async () => {
  const config: Config = { typeKey: 'type', renderers: { item: { types: ['artifact'], keys: {}, templates: [], hidden: ['rarity'] } } }
  await renderPrint('Items/Moonblade.md', '---\ntype: artifact\nrarity: legendary\nowner: "[[Harbor Guild]]"\n---\n', { config })
  expect(fieldsOf()).toEqual(['owner'])
})

test('Map and Document print the name alone', async () => {
  await renderPrint('Maps/The Shattered Coast.md', '---\ntype: map\nimage: "[[coast.jpg]]"\n---\n')
  expect(document.querySelector('.saga-header-title')?.textContent).toBe('The Shattered Coast')
  expect(fieldsOf()).toEqual([])
  document.body.replaceChildren()
  await renderPrint('Notes/Plain.md', '---\ntype: note\n---\n')
  expect(document.querySelector('.saga-header[data-renderer="document"] .saga-header-title')?.textContent).toBe('Plain')
})

test('empty, invalid and unresolved fields are left out', async () => {
  await renderPrint('Characters/Bob2.md', '---\ntype: character\nportrait: "[[missing.png]]"\ntitle: ""\naffiliation: 5\nlocation: "[[Waterdeep]]"\nstatus: unknown\n---\n')
  expect(fieldsOf()).toEqual(['location'])
  document.body.replaceChildren()
  await renderPrint('Characters/Bob3.md', '---\ntype: character\n---\n')
  expect(fieldsOf()).toEqual([])
})

test('link chips show the renderer icon and name, with no buttons', async () => {
  await renderPrint(
    'Factions/Harbor Guild.md',
    '---\ntype: guild\nleader: "[[Bob|Captain Bob]]"\nbase: "[[Waterdeep]]"\nallies:\n  - "[[Nobody]]"\n---\n',
    { config: guild }
  )
  const chip = (field: string) => document.querySelector(`[data-field="${field}"] .saga-header-chip`)
  expect(chip('leader')?.textContent).toBe('Captain Bob')
  expect(chip('leader')?.querySelector('[data-icon="user"]')).not.toBeNull()
  expect(chip('base')?.textContent).toBe('Waterdeep')
  expect(chip('base')?.querySelector('[data-icon="map-pin"]')).not.toBeNull()
  expect(chip('allies')?.classList.contains('is-unresolved')).toBe(true)
  expect(chip('allies')?.textContent).toBe('Nobody')
  expect(chip('allies')?.querySelector('[data-icon="unlink"]')).not.toBeNull()
})

test('nothing in the print view is focusable', async () => {
  await renderPrint('Factions/Harbor Guild.md', '---\ntype: guild\nbanner: "[[coast.jpg]]"\nemblem: "[[portrait.png]]"\nleader: "[[Bob]]"\nallies:\n  - "[[Bob]]"\n---\n', { config: guild })
  expect(document.querySelectorAll('.saga-header-chip').length).toBeGreaterThan(0)
  expect(document.querySelector('button, input, textarea, select, [tabindex], a[href]')).toBeNull()
})

test('the banner takes its object-position from banner-y', async () => {
  await renderPrint('Characters/Ada.md', '---\ntype: character\nbanner: "[[coast.jpg]]"\nbanner-y: 20\n---\n')
  expect(document.querySelector<HTMLImageElement>('.saga-banner img')?.style.objectPosition).toBe('50% 20%')
})

test('an unresolved banner prints no banner', async () => {
  await renderPrint('Characters/Ada.md', '---\ntype: character\nbanner: "[[nothing.jpg]]"\n---\n')
  expect(document.querySelector('.saga-banner')).toBeNull()
})

test('Document: card with the pref on, card with a banner, nothing otherwise', async () => {
  const plain = '---\ntype: note\n---\n'
  const banner = '---\ntype: note\nbanner: "[[coast.jpg]]"\n---\n'
  await renderPrint('Notes/A.md', plain, { documentCard: true })
  expect(document.querySelector('.saga-header')).not.toBeNull()
  document.body.replaceChildren()
  await renderPrint('Notes/A.md', plain, { documentCard: false })
  expect(document.querySelector('.saga-header, .saga-banner')).toBeNull()
  document.body.replaceChildren()
  await renderPrint('Notes/A.md', banner, { documentCard: false })
  expect(document.querySelector('.saga-banner img')).not.toBeNull()
  expect(document.querySelector('.saga-header')).not.toBeNull()
})

test('a Document with an unresolved banner still gets its card, as the header controller does', async () => {
  await renderPrint('Notes/A.md', '---\ntype: note\nbanner: "[[nothing.jpg]]"\n---\n', { documentCard: false })
  expect(document.querySelector('.saga-banner')).toBeNull()
  expect(document.querySelector('.saga-header')).not.toBeNull()
})
