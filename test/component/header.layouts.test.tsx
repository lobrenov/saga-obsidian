import { expect, test } from 'vitest'
import { renderHeader } from './header.support'

const status = (container: Element | null) => container?.querySelector('[role="status"]')?.textContent ?? ''

test('Character: portrait card, name, epithet slot and facts', async () => {
  const { screen, app } = await renderHeader('Characters/Ada Lovelace.md', '---\ntype: character\nportrait: "[[portrait.png]]"\nrole: Mathematician\ntitle: Countess\nlocation: "[[Waterdeep]]"\nstatus: alive\n---\n')
  await expect.element(screen.getByRole('region', { name: 'Character header' })).toBeVisible()
  await expect.element(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible()
  expect(screen.getByRole('img', { name: 'Portrait' }).element().getAttribute('src')).toBe(app.vault.getResourcePath(app.vault.getFileByPath('Attachments/portrait.png') as never))
  await expect.element(screen.getByRole('textbox', { name: 'Role' })).toHaveValue('Mathematician')
  await expect.element(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Countess')
  await expect.element(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('alive')
  await expect.element(screen.getByRole('button', { name: 'Waterdeep', exact: true })).toBeVisible()
  expect(document.querySelector('.saga-header-portrait .saga-header-frame')).not.toBeNull()
  expect(status(document.body)).toBe('')
})

test('Character without its required fields shows the Missing required banner', async () => {
  const { screen } = await renderHeader('Characters/Bob.md', '---\ntype: character\n---\n')
  await expect.element(screen.getByRole('status')).toHaveTextContent('Missing required for the Character renderer: role, location')
  await expect.element(screen.getByRole('textbox', { name: 'Role' })).toHaveValue('')
})

test('the banner lists the required note keys, after renames', async () => {
  const config = { typeKey: 'type', renderers: { character: { types: ['NPC'], keys: { role: 'job' }, templates: [] } } }
  const { screen } = await renderHeader('Characters/Bob.md', '---\ntype: NPC\nrole: ignored\n---\n', { config })
  await expect.element(screen.getByRole('status')).toHaveTextContent('Missing required for the Character renderer: job, location')
  await expect.element(screen.getByRole('textbox', { name: 'Role' })).toHaveValue('')
})

test('Location: image banner, kind and region', async () => {
  const { screen } = await renderHeader('Places/Docks.md', '---\ntype: location\nimage: "[[coast.jpg]]"\nkind: Harbour\nregion: "[[Waterdeep]]"\n---\n')
  await expect.element(screen.getByRole('region', { name: 'Location header' })).toBeVisible()
  expect(document.querySelector('.saga-header-banner img')?.getAttribute('src')).toContain('coast.jpg')
  await expect.element(screen.getByRole('textbox', { name: 'Kind' })).toHaveValue('Harbour')
  await expect.element(screen.getByRole('button', { name: 'Waterdeep', exact: true })).toBeVisible()
  expect(status(document.body)).toBe('')
})

test('Faction: emblem, leader, base and allies', async () => {
  const { screen } = await renderHeader(
    'Factions/Harbor Guild.md',
    '---\ntype: guild\nemblem: "[[portrait.png]]"\nleader: "[[Bob]]"\nbase: "[[Waterdeep]]"\nallies:\n  - "[[Bob]]"\n  - "[[Nobody]]"\n---\n',
    { config: { typeKey: 'type', renderers: { faction: { types: ['guild'], keys: {}, templates: [] } } } }
  )
  await expect.element(screen.getByRole('region', { name: 'Faction header' })).toBeVisible()
  expect(document.querySelector('.saga-header-emblem img')).not.toBeNull()
  await expect.element(screen.getByRole('button', { name: 'Bob' }).first()).toBeVisible()
  expect(document.querySelectorAll('[aria-label="Allies"] .saga-header-chip')).toHaveLength(2)
  expect(document.querySelectorAll('[aria-label="Allies"] .saga-header-chip.is-unresolved')).toHaveLength(1)
})

test('Item: empty banner and the holder, owner, location and origin links', async () => {
  const { screen } = await renderHeader('Items/Moonblade.md', '---\ntype: artifact\nrarity: legendary\nholder: "[[Bob]]"\nowner: "[[Harbor Guild]]"\n---\n', {
    config: { typeKey: 'type', renderers: { item: { types: ['artifact'], keys: {}, templates: [] } } }
  })
  await expect.element(screen.getByRole('region', { name: 'Item header' })).toBeVisible()
  expect(document.querySelector('.saga-header-banner[data-empty]')).not.toBeNull()
  await expect.element(screen.getByRole('textbox', { name: 'Rarity' })).toHaveValue('legendary')
  await expect.element(screen.getByRole('button', { name: 'Bob', exact: true })).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Harbor Guild', exact: true })).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Add origin…' })).toBeVisible()
})

test('Map: image banner and name; a missing image is required', async () => {
  const { screen } = await renderHeader('Maps/The Shattered Coast.md', '---\ntype: map\nimage: "[[coast.jpg]]"\n---\n')
  await expect.element(screen.getByRole('region', { name: 'Map header' })).toBeVisible()
  await expect.element(screen.getByRole('heading', { name: 'The Shattered Coast' })).toBeVisible()
  expect(status(document.body)).toBe('')
})

test('Map without an image shows the banner', async () => {
  const { screen } = await renderHeader('Maps/Empty Map.md', '---\ntype: map\n---\n')
  await expect.element(screen.getByRole('status')).toHaveTextContent('Missing required for the Map renderer: image')
})

test('the renderer label and the type selector', async () => {
  const { screen } = await renderHeader('Characters/Ada Lovelace.md', '---\ntype: character\nrole: R\nlocation: "[[Waterdeep]]"\n---\n')
  expect(document.querySelector('.saga-header-badge')?.textContent).toBe('Character')
  expect(document.querySelector('.saga-header-badge [data-icon="user"]')).not.toBeNull()
  await expect.element(screen.getByRole('combobox', { name: 'Type' })).toHaveValue('character')
})
