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
  style.textContent = `body { --background-primary: rgb(1, 2, 3); --size-4-4: 16px; --size-4-3: 12px; } .view-header { background: rgb(10, 20, 30); } ${bannerCss}`
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

/** `setup` with an image that loads. */
async function setupLoaded(text: string) {
  const context = await setup(text)
  ;(context.app.vault as { getResourcePath: (file: unknown) => string }).getResourcePath = () => SQUARE
  context.sync()
  await vi.waitFor(() => expect(context.host()?.querySelector('img')?.naturalWidth).toBe(1000))
  return context
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

const touch = (target: Element, type: string, x = 10, y = 10): void =>
  void target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 5, pointerType: 'touch', clientX: x, clientY: y }))
const tap = (target: Element): void => {
  touch(target, 'pointerdown')
  touch(target, 'pointerup')
}

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
  image.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
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
  const { host } = await setupLoaded(DOCUMENT)
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner-image')).not.toBeNull())
  const controls = host()!.querySelector('.saga-banner-controls')!
  expect(getComputedStyle(controls).opacity).toBe('0')
  tap(host()!.querySelector('.saga-banner-image')!)
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

const EMBED = '<div class="markdown-embed"><div class="markdown-preview-view"><div class="markdown-preview-sizer"><p>Embedded</p></div></div></div>'

test('an embed inside the view keeps its own sizer unpadded and clickable', async () => {
  const { host, sizer } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()).not.toBeNull())
  sizer.insertAdjacentHTML('beforeend', EMBED)
  const inner = sizer.querySelector<HTMLElement>('.markdown-embed .markdown-preview-sizer')!
  expect(getComputedStyle(sizer).paddingTop).toBe('204px')
  expect(getComputedStyle(sizer).pointerEvents).toBe('none')
  expect(getComputedStyle(inner).paddingTop).toBe('0px')
  expect(getComputedStyle(inner).pointerEvents).not.toBe('none')
  expect(getComputedStyle(inner.parentElement!).position).toBe('static')
})

test('hidden controls take no pointer or focus; hover, focus and a tap reveal them', async () => {
  const { host } = await setupLoaded(DOCUMENT)
  await vi.waitFor(() => expect(button(host()!, 'Remove')).not.toBeNull())
  const controls = host()!.querySelector<HTMLElement>('.saga-banner-controls')!
  expect(getComputedStyle(controls).visibility).toBe('hidden')
  expect(getComputedStyle(controls).pointerEvents).toBe('none')
  host()!.querySelector<HTMLElement>('.saga-banner-image')!.focus()
  await vi.waitFor(() => expect(getComputedStyle(controls).visibility).toBe('visible'))
  expect(getComputedStyle(controls).pointerEvents).toBe('auto')
  button(host()!, 'Remove')!.focus()
  expect(document.activeElement).toBe(button(host()!, 'Remove'))
})

test('Escape in another leaf does not cancel this leaf, and one aimed into it does', async () => {
  const { host, containerEl, controller, leaf } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner')).not.toBeNull())
  controller.reposition(leaf)
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner')?.hasAttribute('data-repositioning')).toBe(true))
  const other = document.createElement('input')
  document.body.append(other)
  other.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(host()?.querySelector('.saga-banner')?.hasAttribute('data-repositioning')).toBe(true)
  containerEl.querySelector('.cm-content')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner')?.hasAttribute('data-repositioning')).toBe(false))
})

test('Escape listens on the banner document, not the global one', async () => {
  const { host, controller, leaf } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner')).not.toBeNull())
  const global = vi.spyOn(globalThis.document, 'addEventListener')
  controller.reposition(leaf)
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner')?.hasAttribute('data-repositioning')).toBe(true))
  expect(global).toHaveBeenCalledWith('keydown', expect.any(Function))
  expect(host()!.ownerDocument).toBe(globalThis.document)
  global.mockRestore()
})

test('a write error shows as an alert', async () => {
  const { host, app, suggesters } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(button(host()!, 'Change banner')).not.toBeNull())
  app.vault.process = () => Promise.reject(new Error('disk full'))
  button(host()!, 'Change banner')?.click()
  await vi.waitFor(() => expect(suggesters).toHaveLength(1))
  suggesters[0]?.pick('portrait.png')
  await vi.waitFor(() => expect(host()?.querySelector('[role="alert"]')?.textContent).toContain('disk full'))
  expect(getComputedStyle(host()!.querySelector('.saga-banner-error')!).overflowWrap).toBe('anywhere')
})

test('the view header turns opaque once content reaches it, before the banner is fully scrolled', async () => {
  const { containerEl, sizer, host } = await setup(DOCUMENT)
  const header = document.createElement('div')
  header.className = 'view-header'
  header.style.height = '40px'
  containerEl.prepend(header)
  const scroller = containerEl.querySelector<HTMLElement>('.cm-scroller')!
  scroller.style.cssText = 'overflow:auto;height:200px'
  sizer.style.height = '1500px'
  await vi.waitFor(() => expect(host()).not.toBeNull())
  // 300 banner - 96 overlap - 40 header
  scroller.scrollTop = 150
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(containerEl.classList.contains('saga-banner-scrolled')).toBe(false)
  scroller.scrollTop = 170
  await vi.waitFor(() => expect(containerEl.classList.contains('saga-banner-scrolled')).toBe(true))
})

test('an embed scroller scrolling does not change the view header', async () => {
  const { containerEl, sizer, host } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()).not.toBeNull())
  sizer.insertAdjacentHTML('beforeend', EMBED)
  const embedScroller = sizer.querySelector<HTMLElement>('.markdown-embed .markdown-preview-view')!
  embedScroller.style.cssText = 'overflow:auto;height:20px'
  embedScroller.querySelector<HTMLElement>('.markdown-preview-sizer')!.style.height = '500px'
  embedScroller.scrollTop = 400
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(containerEl.classList.contains('saga-banner-scrolled')).toBe(false)
})

test('a top scrim lies over the banner image', async () => {
  const { host } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner-image')).not.toBeNull())
  const scrim = getComputedStyle(host()!.querySelector('.saga-banner-image')!, '::after')
  expect(scrim.height).toBe('56px')
  expect(scrim.backgroundImage).toContain('linear-gradient')
})

test('while repositioning the image is a focused slider; arrows move the draft by 1, Shift by 10', async () => {
  const { host, controller, leaf, text } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner')).not.toBeNull())
  controller.reposition(leaf)
  const image = () => host()!.querySelector<HTMLElement>('.saga-banner-image')!
  await vi.waitFor(() => expect(document.activeElement).toBe(image()))
  expect(image().getAttribute('aria-label')).toBe('Banner position')
  expect(host()!.querySelector('.saga-banner-hint')?.getAttribute('role')).toBe('status')
  const key = (name: string, shiftKey = false): void => void image().dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true }))
  key('ArrowUp')
  await vi.waitFor(() => expect(host()!.querySelector('img')?.style.objectPosition).toBe('50% 21%'))
  key('ArrowDown', true)
  await vi.waitFor(() => expect(host()!.querySelector('img')?.style.objectPosition).toBe('50% 11%'))
  button(host()!, 'Save position')?.click()
  await vi.waitFor(() => expect(text()).toContain('banner-y: 11'))
})

test('the controls wrap within a narrow pane', async () => {
  const { host, containerEl, controller, leaf } = await setup(DOCUMENT)
  containerEl.style.width = '360px'
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner')).not.toBeNull())
  controller.reposition(leaf)
  await vi.waitFor(() => expect(button(host()!, 'Save position')).not.toBeNull())
  const box = containerEl.getBoundingClientRect()
  for (const el of host()!.querySelectorAll('.saga-banner-controls, .saga-banner-control')) {
    const rect = el.getBoundingClientRect()
    expect(rect.left).toBeGreaterThanOrEqual(box.left)
    expect(rect.right).toBeLessThanOrEqual(box.right)
  }
})

test('a scroll gesture does not toggle the tapped state, a tap does, and a tap elsewhere clears it', async () => {
  const { host } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner-image')).not.toBeNull())
  const banner = host()!.querySelector('.saga-banner')!
  const image = banner.querySelector('.saga-banner-image')!
  touch(image, 'pointerdown', 10, 10)
  touch(image, 'pointerup', 10, 60)
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(banner.hasAttribute('data-tapped')).toBe(false)
  tap(image)
  await vi.waitFor(() => expect(banner.hasAttribute('data-tapped')).toBe(true))
  touch(document.body, 'pointerdown')
  await vi.waitFor(() => expect(banner.hasAttribute('data-tapped')).toBe(false))
})

test('touch targets are 44 px on a coarse pointer', () => {
  const rules = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]).filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes('pointer: coarse'))
  const text = rules.map((rule) => rule.cssText).join('')
  expect(text).toContain('min-height: 44px')
  expect(text).toContain('.saga-banner-add-button')
  expect(text).toContain('.saga-banner-control')
})

test('with a readable line length the controls sit at the column right edge', async () => {
  const { host, containerEl } = await setupLoaded(DOCUMENT)
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner-actions')).not.toBeNull())
  const view = containerEl.querySelector<HTMLElement>('.markdown-source-view')!
  containerEl.style.width = '1000px'
  const actions = host()!.querySelector<HTMLElement>('.saga-banner-actions')!
  const gap = (): number => host()!.getBoundingClientRect().right - actions.getBoundingClientRect().right
  expect(gap()).toBeCloseTo(16, 0)
  view.classList.add('is-readable-line-width')
  view.style.setProperty('--file-line-width', '600px')
  expect(gap()).toBeCloseTo(216, 0)
})

test('an unresolved link shows a visible message with a Change banner button', async () => {
  const { host } = await setup('---\ntype: note\nbanner: "[[gone.jpg]]"\n---\n')
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner-missing')?.textContent).toBe('Image not found: gone.jpg'))
  const controls = host()!.querySelector('.saga-banner-controls')!
  expect(getComputedStyle(controls).visibility).toBe('visible')
  expect(getComputedStyle(controls).opacity).toBe('1')
  expect(button(host()!, 'Change banner')).not.toBeNull()
  expect(button(host()!, 'Reposition')).toBeNull()
})

test('an image that fails to load shows the message', async () => {
  const { host } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(host()?.querySelector('.saga-banner-missing')?.textContent).toBe('Image not found: coast.jpg'))
  expect(host()!.querySelector('img')?.hidden).toBe(true)
})

test('the picker is a labelled group; Esc returns focus to the trigger and the trigger reports aria-expanded', async () => {
  const { host, suggesters } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(button(host()!, 'Change banner')).not.toBeNull())
  const trigger = button(host()!, 'Change banner')!
  trigger.click()
  await vi.waitFor(() => expect(suggesters).toHaveLength(1))
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  const popover = host()!.querySelector('.saga-banner-popover')!
  expect(popover.getAttribute('role')).toBe('group')
  expect(popover.getAttribute('aria-label')).toBe('Choose banner image')
  suggesters[0]?.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await vi.waitFor(() => expect(host()!.querySelector('.saga-banner-popover')).toBeNull())
  await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
})

test('a pick returns focus to Change banner', async () => {
  const { host, suggesters } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(button(host()!, 'Change banner')).not.toBeNull())
  button(host()!, 'Change banner')!.click()
  await vi.waitFor(() => expect(suggesters).toHaveLength(1))
  suggesters[0]?.pick('portrait.png')
  await vi.waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe('Change banner'))
})

test('the popover stays open when focus moves to a suggestion, and closes on a plain blur', async () => {
  const { host, suggesters } = await setup(DOCUMENT)
  await vi.waitFor(() => expect(button(host()!, 'Change banner')).not.toBeNull())
  button(host()!, 'Change banner')!.click()
  await vi.waitFor(() => expect(suggesters).toHaveLength(1))
  const input = suggesters[0]!.input
  const item = document.createElement('div')
  item.className = 'suggestion-container'
  item.tabIndex = 0
  document.body.append(item)
  input.focus()
  item.focus()
  await new Promise((resolve) => setTimeout(resolve, 30))
  expect(host()!.querySelector('.saga-banner-popover')).not.toBeNull()
  const plain = document.createElement('button')
  document.body.append(plain)
  input.focus()
  plain.focus()
  await vi.waitFor(() => expect(host()!.querySelector('.saga-banner-popover')).toBeNull())
  expect(document.activeElement).toBe(plain)
})

test('banner buttons have an accent focus-visible outline', () => {
  const rule = [...document.styleSheets]
    .flatMap((sheet) => [...sheet.cssRules])
    .find((candidate): candidate is CSSStyleRule => candidate instanceof CSSStyleRule && candidate.selectorText.includes('.saga-banner-add-button:focus-visible'))
  expect(rule?.selectorText).toContain('.saga-banner-control:focus-visible')
  expect(rule?.style.outline).toBe('2px solid var(--interactive-accent)')
})
