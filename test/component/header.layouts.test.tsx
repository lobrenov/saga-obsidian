import { expect, test } from 'vitest'
import { renderHeader } from './header.support'

test('Character: portrait card, name, epithet slot and facts', async () => {
  const { screen, app } = await renderHeader('Characters/Ada Lovelace.md', '---\ntype: character\nportrait: "[[portrait.png]]"\ntitle: Countess\nlocation: "[[Waterdeep]]"\nstatus: alive\n---\n')
  await expect.element(screen.getByRole('region', { name: 'Character header' })).toBeVisible()
  await expect.element(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible()
  expect(screen.getByRole('img', { name: 'Portrait' }).element().getAttribute('src')).toBe(app.vault.getResourcePath(app.vault.getFileByPath('Attachments/portrait.png') as never))
  await expect.element(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Countess')
  await expect.element(screen.getByRole('button', { name: 'Status' })).toHaveTextContent('Alive')
  await expect.element(screen.getByRole('button', { name: 'Waterdeep', exact: true })).toBeVisible()
  expect(document.querySelector('.saga-header-portrait .saga-header-frame')).not.toBeNull()
})

test('Character facts are affiliation, location and status', async () => {
  await renderHeader('Characters/Bob.md', '---\ntype: character\n---\n')
  expect([...document.querySelectorAll('.saga-header-facts [data-field]')].map((el) => el.getAttribute('data-field'))).toEqual(['affiliation', 'location', 'status'])
  expect(document.querySelector('[role="status"]')).toBeNull()
})

test('Location: kind and region, with no image frame in the body', async () => {
  const { screen } = await renderHeader('Places/Docks.md', '---\ntype: location\nimage: "[[coast.jpg]]"\nkind: Harbour\nregion: "[[Waterdeep]]"\n---\n')
  await expect.element(screen.getByRole('region', { name: 'Location header' })).toBeVisible()
  expect(document.querySelector('.saga-header-body img, .saga-header-body .saga-header-frame')).toBeNull()
  await expect.element(screen.getByRole('textbox', { name: 'Kind' })).toHaveValue('Harbour')
  await expect.element(screen.getByRole('button', { name: 'Waterdeep', exact: true })).toBeVisible()
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
  expect(document.querySelectorAll('[data-field="allies"] .saga-header-chip')).toHaveLength(2)
  expect(document.querySelectorAll('[data-field="allies"] .saga-header-chip.is-unresolved')).toHaveLength(1)
  expect(document.querySelector('.saga-header[aria-label]')).toBeNull()
})

test('Item: image beside the name, kind, rarity, owner and location', async () => {
  const { screen } = await renderHeader('Items/Moonblade.md', '---\ntype: artifact\nimage: "[[portrait.png]]"\nrarity: legendary\nholder: "[[Bob]]"\nowner: "[[Harbor Guild]]"\n---\n', {
    config: { typeKey: 'type', renderers: { item: { types: ['artifact'], keys: {}, templates: [] } } }
  })
  await expect.element(screen.getByRole('region', { name: 'Item header' })).toBeVisible()
  expect(document.querySelector('.saga-header-split .saga-header-emblem img')).not.toBeNull()
  await expect.element(screen.getByRole('textbox', { name: 'Rarity' })).toHaveValue('legendary')
  await expect.element(screen.getByRole('button', { name: 'Harbor Guild', exact: true })).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Add location…' })).toBeVisible()
  expect([...document.querySelectorAll('.saga-header-facts [data-field]')].map((el) => el.getAttribute('data-field'))).toEqual(['kind', 'rarity', 'owner', 'location'])
})

test('hidden fields are left out even with a value, and facts with every field hidden draw no rule', async () => {
  const hidden = { typeKey: 'type', renderers: { character: { types: ['character'], keys: {}, templates: [], hidden: ['title', 'affiliation', 'location', 'status'] } } }
  await renderHeader('Characters/Ada Lovelace.md', '---\ntype: character\ntitle: Countess\nstatus: alive\n---\n', { config: hidden })
  expect([...document.querySelectorAll('[data-field]')].map((el) => el.getAttribute('data-field'))).toEqual(['portrait'])
  expect(document.querySelector('.saga-header-facts')).toBeNull()
})

test('Map: name only', async () => {
  const { screen } = await renderHeader('Maps/The Shattered Coast.md', '---\ntype: map\nimage: "[[coast.jpg]]"\n---\n')
  await expect.element(screen.getByRole('region', { name: 'Map header' })).toBeVisible()
  await expect.element(screen.getByRole('heading', { name: 'The Shattered Coast' })).toBeVisible()
})

test('the renderer label and the type selector', async () => {
  const { screen } = await renderHeader('Characters/Ada Lovelace.md', '---\ntype: character\nlocation: "[[Waterdeep]]"\n---\n')
  expect(document.querySelector('.saga-header-badge')?.textContent).toBe('Character')
  expect(document.querySelector('.saga-header-badge [data-icon="user"]')).not.toBeNull()
  await expect.element(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Character')
})
