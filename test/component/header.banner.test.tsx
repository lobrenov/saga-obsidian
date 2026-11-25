import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import bannerCss from '../../src/banner/banner.css?inline'
import headerCss from '../../src/header/header.css?inline'
import { createBannerController } from '../../src/banner/controller'
import { createHeaderController, type LeafView } from '../../src/header/controller'
import { createConfigStore } from '../../src/obsidian/vault'
import { HeaderFakeApp, testEnv } from '../fakes/header'
import { FILES, liveView } from './header.support'

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  const style = document.createElement('style')
  style.textContent = `${headerCss} ${bannerCss}`
  document.head.append(style)
})
afterEach(() => document.body.replaceChildren())

const note = 'Notes/Test.md'
const DOCUMENT = '---\ntype: note\nbanner: "[[coast.jpg]]"\nbanner-y: 20\n---\n'
const PLAIN = '---\ntype: character\n---\n'
const MAP = '---\ntype: map\nimage: "[[coast.jpg]]"\n---\n'

/** Both controllers over one leaf, wired as `registerHeader` does. */
async function setup(text: string, documentCard = false) {
  const app = new HeaderFakeApp()
  for (const [path, content] of Object.entries(FILES)) app.addFile(path, content)
  const file = app.addFile(note, text)
  const { env, suggesters, menus, choose } = testEnv(app)
  const config = await createConfigStore(app.asApp(), app.owner())
  const banners = createBannerController(env, config, () => documentCard)
  const headers = createHeaderController(env, config, (key) => banners.reposition(key), () => documentCard)
  const leaf = {}
  const { containerEl } = liveView()
  const sync = (): void => {
    const views: [object, LeafView][] = [[leaf, { containerEl, file, mode: 'live' }]]
    headers.sync(views)
    banners.sync(views)
  }
  app.metadataCache.on('changed', sync)
  sync()
  return { app, containerEl, suggesters, menus, choose, text: () => app.text(note), bar: () => containerEl.querySelector('.saga-header-bar') }
}

const button = (root: ParentNode | null, name: string): HTMLButtonElement | null =>
  [...(root?.querySelectorAll('button') ?? [])].find((candidate) => candidate.textContent?.trim() === name) ?? null

test('a Document note with a banner gets a Document card with Banner, Set type and Properties', async () => {
  const { containerEl, bar } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-header[data-renderer="document"]')).not.toBeNull())
  expect(containerEl.querySelector('.saga-header-badge')?.textContent).toBe('Document')
  expect(containerEl.querySelector('.saga-header-badge [data-icon="file-text"]')).not.toBeNull()
  expect(button(bar(), 'Banner')).not.toBeNull()
  expect(button(bar(), 'Set type')).not.toBeNull()
  expect(button(bar(), 'Properties')).not.toBeNull()
  expect(containerEl.querySelector('.saga-header-title')?.textContent).toBe('Test')
  expect(containerEl.querySelector('.saga-header-facts')).toBeNull()
})

test('the Document card lists every configured type and choosing one writes typeKey', async () => {
  const { containerEl, bar, menus, choose, text } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(button(bar(), 'Set type')).not.toBeNull())
  button(bar(), 'Set type')?.click()
  expect(menus.at(-1)?.items.map((item) => item.title)).toEqual(['character', 'location', 'faction', 'item', 'map', 'calendar'])
  choose('location')
  await vi.waitFor(() => expect(text()).toBe(DOCUMENT.replace('type: note', 'type: location')))
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-header[data-renderer="location"]')).not.toBeNull())
})

test('removing the banner from the bar removes the Document card', async () => {
  const { containerEl, bar, choose, text } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(button(bar(), 'Banner')).not.toBeNull())
  button(bar(), 'Banner')?.click()
  choose('Remove banner')
  await vi.waitFor(() => expect(text()).toBe('---\ntype: note\n---\n'))
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-header')).toBeNull())
})

test('the bar shows Add banner without a banner; a pick writes banner for a Character', async () => {
  const { bar, suggesters, text } = await setup(PLAIN)
  await vi.waitFor(() => expect(button(bar(), 'Add banner')).not.toBeNull())
  expect(button(bar(), 'Banner')).toBeNull()
  button(bar(), 'Add banner')?.click()
  await vi.waitFor(() => expect(suggesters).toHaveLength(1))
  expect(suggesters[0]?.kind).toBe('image')
  suggesters[0]?.pick('coast.jpg')
  await vi.waitFor(() => expect(text()).toBe('---\ntype: character\nbanner: "[[coast.jpg]]"\n---\n'))
  await vi.waitFor(() => expect(button(bar(), 'Banner')).not.toBeNull())
})

test('a Location pick writes image', async () => {
  const { bar, suggesters, text } = await setup('---\ntype: location\n---\n')
  await vi.waitFor(() => expect(button(bar(), 'Add banner')).not.toBeNull())
  button(bar(), 'Add banner')?.click()
  await vi.waitFor(() => expect(suggesters).toHaveLength(1))
  suggesters[0]?.pick('coast.jpg')
  await vi.waitFor(() => expect(text()).toBe('---\ntype: location\nimage: "[[coast.jpg]]"\n---\n'))
})

test('Change banner in the menu opens the image picker and a pick rewrites the key', async () => {
  const { bar, menus, choose, suggesters, text } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(button(bar(), 'Banner')).not.toBeNull())
  button(bar(), 'Banner')?.click()
  expect(menus.at(-1)?.items.map((item) => item.title)).toEqual(['Change banner…', 'Reposition banner', 'Remove banner'])
  choose('Change banner…')
  await vi.waitFor(() => expect(suggesters).toHaveLength(1))
  suggesters[0]?.pick('portrait.png')
  await vi.waitFor(() => expect(text()).toBe(DOCUMENT.replace('coast.jpg', 'portrait.png')))
})

test("a Map's button reads Map image and its menu has no Remove", async () => {
  const { bar, menus } = await setup(MAP)
  await vi.waitFor(() => expect(button(bar(), 'Map image')).not.toBeNull())
  button(bar(), 'Map image')?.click()
  expect(menus.at(-1)?.items.map((item) => item.title)).toEqual(['Change banner…', 'Reposition banner'])
})

test("the menu's Reposition puts the banner into reposition mode", async () => {
  const { containerEl, bar, choose } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(button(bar(), 'Banner')).not.toBeNull())
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-banner')).not.toBeNull())
  button(bar(), 'Banner')?.click()
  choose('Reposition banner')
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-banner')?.hasAttribute('data-repositioning')).toBe(true))
})

test('a Location with an image has no image frame in its body', async () => {
  const { containerEl } = await setup('---\ntype: location\nimage: "[[coast.jpg]]"\n---\n')
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-header')).not.toBeNull())
  expect(containerEl.querySelector('.saga-header-body .saga-header-frame, .saga-header-body img')).toBeNull()
})

test('the bar picker stays inside the card, the error wraps in the bar, and focus returns to the bar button', async () => {
  const { containerEl, bar, suggesters, app } = await setup(PLAIN)
  containerEl.style.width = '360px'
  await vi.waitFor(() => expect(button(bar(), 'Add banner')).not.toBeNull())
  const trigger = button(bar(), 'Add banner')!
  trigger.click()
  await vi.waitFor(() => expect(suggesters).toHaveLength(1))
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  const card = containerEl.querySelector('.saga-header')!.getBoundingClientRect()
  const popover = containerEl.querySelector('.saga-banner-popover')!
  expect(popover.getAttribute('role')).toBe('group')
  const box = popover.getBoundingClientRect()
  expect(box.left).toBeGreaterThanOrEqual(card.left)
  expect(box.right).toBeLessThanOrEqual(card.right)
  app.vault.process = () => Promise.reject(new Error('a long failure message '.repeat(8)))
  suggesters[0]?.pick('coast.jpg')
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-header-bar > [role="alert"]')).not.toBeNull())
  const alert = containerEl.querySelector('.saga-header-bar > [role="alert"]')!.getBoundingClientRect()
  expect(alert.right).toBeLessThanOrEqual(card.right)
  expect(alert.top).toBeGreaterThanOrEqual(trigger.getBoundingClientRect().bottom)
  await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
})

test('the banner control sits on the right, just before the Type selector', async () => {
  const { containerEl, bar } = await setup(PLAIN)
  containerEl.style.width = '1000px'
  await vi.waitFor(() => expect(button(bar(), 'Add banner')).not.toBeNull())
  const badge = bar()!.querySelector('.saga-header-badge')!.getBoundingClientRect()
  const control = button(bar(), 'Add banner')!.getBoundingClientRect()
  const type = bar()!.querySelector('.saga-header-type')!.getBoundingClientRect()
  expect(control.left - badge.right).toBeGreaterThan(200)
  expect(type.left - control.right).toBeLessThan(24)
})

test('with the Document card setting on, an untyped note without a banner gets the card with Add banner and no Add host', async () => {
  const { containerEl, bar } = await setup('---\ntype: note\n---\n', true)
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-header-badge')?.textContent).toBe('Document'))
  expect(button(bar(), 'Add banner')).not.toBeNull()
  expect(containerEl.querySelector('.saga-banner-add-host')).toBeNull()
  expect(containerEl.classList.contains('saga-header-active')).toBe(true)
})

test('with the Document card setting on, removing the banner keeps the card', async () => {
  const { containerEl, bar, choose, text } = await setup(DOCUMENT, true)
  await vi.waitFor(() => expect(button(bar(), 'Banner')).not.toBeNull())
  button(bar(), 'Banner')?.click()
  choose('Remove banner')
  await vi.waitFor(() => expect(text()).toBe('---\ntype: note\n---\n'))
  await vi.waitFor(() => expect(button(bar(), 'Add banner')).not.toBeNull())
  expect(containerEl.querySelector('.saga-header-badge')?.textContent).toBe('Document')
  expect(containerEl.querySelector('.saga-banner-host')).toBeNull()
})
