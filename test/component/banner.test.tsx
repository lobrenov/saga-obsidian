import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import bannerCss from '../../src/banner/banner.css?inline'
import { createBannerController } from '../../src/banner/controller'
import type { LeafView } from '../../src/header/controller'
import { createConfigStore } from '../../src/obsidian/vault'
import { HeaderFakeApp, testEnv } from '../fakes/header'
import { FILES, liveView, readingView } from './header.support'

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  const style = document.createElement('style')
  style.textContent = `body { --background-primary: rgb(1, 2, 3); } .view-header { background: rgb(10, 20, 30); } ${bannerCss}`
  document.head.append(style)
})
afterEach(() => document.body.replaceChildren())

const note = 'Notes/Test.md'
const LOCATION = '---\ntype: location\nimage: "[[coast.jpg]]"\n---\n'
const DOCUMENT = '---\ntype: note\nbanner: "[[coast.jpg]]"\nbanner-y: 20\n---\n'
const MAP = '---\ntype: map\nimage: "[[coast.jpg]]"\n---\n'
/** A 1000 x 1000 image, so a vertical drag has room to move. */
const SQUARE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="teal"/></svg>')}`

async function setup(text: string, mode: LeafView['mode'] = 'live') {
  const app = new HeaderFakeApp()
  for (const [path, content] of Object.entries(FILES)) app.addFile(path, content)
  const file = app.addFile(note, text)
  const { env, suggesters } = testEnv(app)
  const config = await createConfigStore(app.asApp(), app.owner())
  const controller = createBannerController(env, config)
  const leaf = {}
  const dom = mode === 'reading' ? readingView() : liveView()
  const sync = (nextMode: LeafView['mode'] = mode): void => controller.sync([[leaf, { containerEl: dom.containerEl, file, mode: nextMode }]])
  app.metadataCache.on('changed', () => sync())
  sync()
  return { app, controller, leaf, sync, suggesters, ...dom, text: () => app.text(note), host: () => dom.containerEl.querySelector<HTMLElement>('.saga-banner-host') }
}

const button = (root: ParentNode, name: string): HTMLButtonElement | null =>
  [...root.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === name) ?? null
const pointer = (target: Element, type: string, y: number): void =>
  void target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: 100, clientY: y, view: window }))

test('a Location note draws its banner from image, before the sizer, and marks the view', async () => {
  const { host, sizer, containerEl } = await setup(LOCATION)
  await vi.waitFor(() => expect(host()?.querySelector('img')).not.toBeNull())
  expect(host()?.nextElementSibling).toBe(sizer)
  expect(host()?.querySelector('img')?.getAttribute('src')).toBe(`app://local/${encodeURIComponent('Attachments/coast.jpg')}`)
  expect(containerEl.classList.contains('saga-banner-active')).toBe(true)
})

test('a Document note draws its banner from banner, with banner-y as the image position', async () => {
  const { host } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()?.querySelector('img')).not.toBeNull())
  expect(host()?.querySelector('img')?.style.objectPosition).toBe('50% 20%')
})

test('Reading view places the banner before the preview sizer', async () => {
  const { host, sizer } = await setup(DOCUMENT, 'reading')
  await vi.waitFor(() => expect(host()?.querySelector('img')).not.toBeNull())
  expect(host()?.nextElementSibling).toBe(sizer)
})

test('a Character with only image has no banner and no Add button', async () => {
  const { host, containerEl } = await setup('---\ntype: character\nimage: "[[coast.jpg]]"\n---\n')
  expect(host()).toBeNull()
  expect(containerEl.querySelector('.saga-banner-add-host')).toBeNull()
  expect(containerEl.classList.contains('saga-banner-active')).toBe(false)
})

test('without a banner a Document note shows Add banner under the title; a pick writes banner', async () => {
  const { containerEl, suggesters, text } = await setup('---\ntype: note\n---\n')
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-banner-add-host')).not.toBeNull())
  expect(containerEl.querySelector('.inline-title')?.nextElementSibling?.className).toBe('saga-banner-add-host')
  await vi.waitFor(() => expect(button(containerEl, 'Add banner')).not.toBeNull())
  button(containerEl, 'Add banner')?.click()
  await vi.waitFor(() => expect(suggesters).toHaveLength(1))
  expect(suggesters[0]?.kind).toBe('image')
  suggesters[0]?.pick('coast.jpg')
  await vi.waitFor(() => expect(text()).toBe('---\ntype: note\nbanner: "[[coast.jpg]]"\n---\n'))
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-banner-host img')).not.toBeNull())
  expect(containerEl.querySelector('.saga-banner-add-host')).toBeNull()
})

test('Escape closes the Add banner popover and writes nothing', async () => {
  const { containerEl, suggesters, app } = await setup('---\ntype: note\n---\n')
  await vi.waitFor(() => expect(button(containerEl, 'Add banner')).not.toBeNull())
  button(containerEl, 'Add banner')?.click()
  await vi.waitFor(() => expect(suggesters).toHaveLength(1))
  suggesters[0]?.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-banner-popover')).toBeNull())
  expect(app.processed).toEqual([])
})

test('Change opens the image suggester and a pick rewrites the banner key', async () => {
  const { host, suggesters, text } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(button(host()!, 'Change banner')).not.toBeNull())
  button(host()!, 'Change banner')?.click()
  await vi.waitFor(() => expect(suggesters).toHaveLength(1))
  suggesters[0]?.pick('portrait.png')
  await vi.waitFor(() => expect(text()).toBe(DOCUMENT.replace('coast.jpg', 'portrait.png')))
})

test('banner-tall on the view makes the banner 440 px, else 300 px', async () => {
  const { host, containerEl } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()).not.toBeNull())
  expect(host()?.offsetHeight).toBe(300)
  containerEl.querySelector('.markdown-source-view')?.classList.add('banner-tall')
  expect(host()?.offsetHeight).toBe(440)
})

test('Remove deletes the banner key and banner-y; the banner goes and Add banner returns', async () => {
  const { host, containerEl, text } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(button(host()!, 'Remove')).not.toBeNull())
  button(host()!, 'Remove')?.click()
  await vi.waitFor(() => expect(text()).toBe('---\ntype: note\n---\n'))
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-banner-add-host')).not.toBeNull())
  expect(host()).toBeNull()
  expect(containerEl.classList.contains('saga-banner-active')).toBe(false)
})

test('a Map banner has no Remove', async () => {
  const { host } = await setup(MAP)
  await vi.waitFor(() => expect(button(host()!, 'Change banner')).not.toBeNull())
  expect(button(host()!, 'Remove')).toBeNull()
})

async function reposition() {
  const context = await setup(DOCUMENT)
  ;(context.app.vault as { getResourcePath: (file: unknown) => string }).getResourcePath = () => SQUARE
  context.sync()
  const { host } = context
  await vi.waitFor(() => expect(host()?.querySelector('img')?.naturalWidth).toBe(1000))
  button(host()!, 'Reposition')?.click()
  await vi.waitFor(() => expect(host()?.textContent).toContain('Drag the image to reposition'))
  const image = host()!.querySelector('.saga-banner-image')!
  const start = image.getBoundingClientRect().top + 100
  pointer(image, 'pointerdown', start)
  pointer(image, 'pointermove', start + 25)
  pointer(image, 'pointermove', start + 50)
  pointer(image, 'pointerup', start + 50)
  return { ...context, image }
}

test('Reposition, a 50 px drag down and Save position writes a lower banner-y', async () => {
  const { host, text, image } = await reposition()
  await vi.waitFor(() => expect(Number.parseInt(image.querySelector('img')?.style.objectPosition.split(' ')[1] ?? '')).toBeLessThan(20))
  expect(host()?.querySelector('.saga-banner')?.hasAttribute('data-repositioning')).toBe(true)
  button(host()!, 'Save position')?.click()
  await vi.waitFor(() => expect(text()).not.toBe(DOCUMENT))
  const y = Number(/banner-y: (\d+)\n/.exec(text())?.[1])
  expect(Number.isInteger(y)).toBe(true)
  expect(y).toBeGreaterThanOrEqual(10)
  expect(y).toBeLessThan(20)
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner')?.hasAttribute('data-repositioning')).toBe(false))
})

test('Escape after a drag restores the position and writes nothing', async () => {
  const { host, app, image } = await reposition()
  await vi.waitFor(() => expect(image.querySelector('img')?.style.objectPosition).not.toBe('50% 20%'))
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner')?.hasAttribute('data-repositioning')).toBe(false))
  expect(image.querySelector('img')?.style.objectPosition).toBe('50% 20%')
  expect(app.processed).toEqual([])
})

test('Cancel restores the position and writes nothing', async () => {
  const { host, app, image } = await reposition()
  button(host()!, 'Cancel')?.click()
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner')?.hasAttribute('data-repositioning')).toBe(false))
  expect(image.querySelector('img')?.style.objectPosition).toBe('50% 20%')
  expect(app.processed).toEqual([])
})

test('reposition(key) puts the leaf into reposition mode', async () => {
  const { controller, leaf, host } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner')).not.toBeNull())
  controller.reposition(leaf)
  await vi.waitFor(() => expect(host()?.textContent).toContain('Drag the image to reposition'))
})

test('a tap on a touch screen shows the controls', async () => {
  const { host } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner-image')).not.toBeNull())
  const controls = host()!.querySelector('.saga-banner-controls')!
  expect(getComputedStyle(controls).opacity).toBe('0')
  host()!.querySelector('.saga-banner-image')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 5 }))
  await vi.waitFor(() => expect(getComputedStyle(controls).opacity).toBe('1'))
})

test('the view header is transparent over the banner and gets its background back once scrolled past it', async () => {
  const { containerEl, sizer, host } = await setup(DOCUMENT)
  const header = document.createElement('div')
  header.className = 'view-header'
  containerEl.prepend(header)
  const scroller = containerEl.querySelector<HTMLElement>('.cm-scroller')!
  scroller.style.cssText = 'overflow:auto;height:200px'
  sizer.style.height = '1500px'
  await vi.waitFor(() => expect(host()).not.toBeNull())
  expect(getComputedStyle(header).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  scroller.scrollTop = 400
  await vi.waitFor(() => expect(containerEl.classList.contains('saga-banner-scrolled')).toBe(true))
  expect(getComputedStyle(header).backgroundColor).toBe('rgb(1, 2, 3)')
  scroller.scrollTop = 50
  await vi.waitFor(() => expect(containerEl.classList.contains('saga-banner-scrolled')).toBe(false))
})

test('Source mode, no file and closing the leaf leave no banner and no classes', async () => {
  const { host, sync, containerEl, controller } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()).not.toBeNull())
  sync('source')
  expect(host()).toBeNull()
  expect(containerEl.classList.contains('saga-banner-active')).toBe(false)
  sync('live')
  await vi.waitFor(() => expect(host()).not.toBeNull())
  controller.sync([])
  expect(host()).toBeNull()
  expect(containerEl.classList.contains('saga-banner-active')).toBe(false)
})

test('a banner inside an embed is hidden', async () => {
  const { host, containerEl } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()).not.toBeNull())
  const embed = document.createElement('div')
  embed.className = 'markdown-embed'
  containerEl.replaceWith(embed)
  embed.append(containerEl)
  expect(getComputedStyle(host()!).display).toBe('none')
})

test('the banner is placed again when Obsidian re-creates the sizer', async () => {
  const { host, sizer } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()).not.toBeNull())
  const fresh = sizer.cloneNode(true) as HTMLElement
  sizer.replaceWith(fresh)
  await vi.waitFor(() => expect(host()?.nextElementSibling).toBe(fresh))
})
