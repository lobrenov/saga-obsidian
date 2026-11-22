import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import headerCss from '../../src/header/header.css?inline'
import { userEvent } from 'vitest/browser'
import { createHeaderController, type LeafView } from '../../src/header/controller'
import { createConfigStore } from '../../src/obsidian/vault'
import { HeaderFakeApp, testEnv } from '../fakes/header'
import { ADA, FILES, liveView, readingView } from './header.support'

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
})
afterEach(() => document.body.replaceChildren())

const ada = 'Characters/Ada Lovelace.md'

async function setup(text = ADA) {
  const app = new HeaderFakeApp()
  for (const [path, content] of Object.entries(FILES)) app.addFile(path, content)
  const file = app.addFile(ada, text)
  const { env } = testEnv(app)
  const config = await createConfigStore(app.asApp(), app.owner())
  const controller = createHeaderController(env, config, () => undefined, () => false)
  const view = (containerEl: HTMLElement, mode: LeafView['mode'] = 'live'): LeafView => ({ containerEl, file, mode })
  return { app, file, controller, view }
}

const headers = (root: ParentNode = document) => root.querySelectorAll('.saga-header')

test('Live Preview: a header mounts before the inline title and the view is marked active', async () => {
  const { controller, view } = await setup()
  const { containerEl, sizer } = liveView()
  controller.sync([[{}, view(containerEl)]])
  await vi.waitFor(() => expect(headers(containerEl)).toHaveLength(1))
  expect(containerEl.classList.contains('saga-header-active')).toBe(true)
  expect(sizer.querySelector('.saga-header-host')?.nextElementSibling?.className).toBe('inline-title')
  expect(containerEl.querySelector('.saga-header-title')?.textContent).toBe('Ada Lovelace')
})

test('Reading view: a header mounts before .mod-header', async () => {
  const { controller, view } = await setup()
  const { containerEl, sizer } = readingView()
  controller.sync([[{}, view(containerEl, 'reading')]])
  await vi.waitFor(() => expect(headers(containerEl)).toHaveLength(1))
  expect(sizer.querySelector('.saga-header-host')?.nextElementSibling?.className).toBe('mod-header')
})

test('Source mode and document notes get no header and keep the native UI', async () => {
  const { controller, view, app } = await setup()
  const { containerEl } = liveView()
  controller.sync([[{}, view(containerEl, 'source')]])
  expect(headers(containerEl)).toHaveLength(0)
  expect(containerEl.classList.contains('saga-header-active')).toBe(false)

  app.addFile(ada, '---\ntype: note\n---\n')
  controller.sync([[{}, view(containerEl)]])
  expect(headers(containerEl)).toHaveLength(0)
  expect(containerEl.querySelector('.saga-header-host')).toBeNull()
})

test('switching to Source mode, to a document note or closing the leaf unmounts the header', async () => {
  const { controller, view, app } = await setup()
  const { containerEl } = liveView()
  const leaf = {}
  controller.sync([[leaf, view(containerEl)]])
  await vi.waitFor(() => expect(headers(containerEl)).toHaveLength(1))

  controller.sync([[leaf, view(containerEl, 'source')]])
  expect(containerEl.querySelector('.saga-header-host')).toBeNull()
  expect(containerEl.classList.contains('saga-header-active')).toBe(false)

  controller.sync([[leaf, view(containerEl)]])
  await vi.waitFor(() => expect(headers(containerEl)).toHaveLength(1))
  app.addFile(ada, '---\ntype: note\n---\n')
  controller.sync([[leaf, view(containerEl)]])
  expect(containerEl.querySelector('.saga-header-host')).toBeNull()

  app.addFile(ada, ADA)
  controller.sync([[leaf, view(containerEl)]])
  await vi.waitFor(() => expect(headers(containerEl)).toHaveLength(1))
  controller.sync([])
  expect(containerEl.querySelector('.saga-header-host')).toBeNull()
  expect(containerEl.classList.contains('saga-header-active')).toBe(false)
})

test('split panes on the same note each get a header', async () => {
  const { controller, view } = await setup()
  const left = liveView()
  const right = readingView()
  controller.sync([
    [{}, view(left.containerEl)],
    [{}, view(right.containerEl, 'reading')]
  ])
  await vi.waitFor(() => expect(headers()).toHaveLength(2))
  expect(headers(left.containerEl)).toHaveLength(1)
  expect(headers(right.containerEl)).toHaveLength(1)
})

test('a type change applies without reopening', async () => {
  const { controller, view, app } = await setup()
  const { containerEl } = liveView()
  const leaf = {}
  controller.sync([[leaf, view(containerEl)]])
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-header')?.getAttribute('data-renderer')).toBe('character'))
  app.addFile(ada, '---\ntype: location\n---\n')
  controller.sync([[leaf, view(containerEl)]])
  await vi.waitFor(() => expect(containerEl.querySelector('.saga-header')?.getAttribute('data-renderer')).toBe('location'))
  expect(headers(containerEl)).toHaveLength(1)
})

test('the Properties toggle reveals the native properties for that leaf only', async () => {
  const { controller, view } = await setup()
  const left = liveView()
  const right = liveView()
  controller.sync([
    [{}, view(left.containerEl)],
    [{}, view(right.containerEl)]
  ])
  await vi.waitFor(() => expect(headers()).toHaveLength(2))
  const toggle = left.containerEl.querySelector<HTMLButtonElement>('.saga-header-toggle')
  toggle?.click()
  await vi.waitFor(() => expect(left.containerEl.classList.contains('saga-header-properties')).toBe(true))
  expect(left.containerEl.querySelector('.saga-header-toggle')?.getAttribute('aria-pressed')).toBe('true')
  expect(right.containerEl.classList.contains('saga-header-properties')).toBe(false)
  controller.sync([
    [{}, view(left.containerEl)],
    [{}, view(right.containerEl)]
  ])
  toggle?.click()
  await vi.waitFor(() => expect(left.containerEl.classList.contains('saga-header-properties')).toBe(false))
})

test('the native title and properties are hidden under the active class unless the toggle is on', async () => {
  const style = document.createElement('style')
  style.textContent = headerCss
  document.head.append(style)
  const { controller, view } = await setup()
  const { containerEl } = liveView()
  controller.sync([[{}, view(containerEl)]])
  await vi.waitFor(() => expect(headers(containerEl)).toHaveLength(1))
  const title = containerEl.querySelector('.inline-title') as HTMLElement
  const properties = containerEl.querySelector('.metadata-container') as HTMLElement
  expect(getComputedStyle(title).display).toBe('none')
  expect(getComputedStyle(properties).display).toBe('none')
  containerEl.querySelector<HTMLButtonElement>('.saga-header-toggle')?.click()
  await vi.waitFor(() => expect(getComputedStyle(properties).display).not.toBe('none'))
  expect(getComputedStyle(title).display).toBe('none')
  style.remove()
})

test('the host is placed again when the view drops it, and when the sizer appears late', async () => {
  const { controller, view } = await setup()
  const { containerEl, sizer } = liveView()
  controller.sync([[{}, view(containerEl)]])
  await vi.waitFor(() => expect(headers(containerEl)).toHaveLength(1))
  containerEl.querySelector('.saga-header-host')?.remove()
  await vi.waitFor(() => expect(sizer.querySelector('.saga-header-host')).not.toBeNull())

  const late = document.createElement('div')
  late.className = 'workspace-leaf-content'
  document.body.append(late)
  controller.sync([[{}, view(late)]])
  expect(late.classList.contains('saga-header-active')).toBe(false)
  late.innerHTML = '<div class="markdown-source-view"><div class="cm-sizer"><div class="inline-title"></div></div></div>'
  await vi.waitFor(() => expect(late.classList.contains('saga-header-active')).toBe(true))
  expect(late.querySelector('.cm-sizer')?.firstElementChild?.className).toBe('saga-header-host')
})

test('dispose unmounts every header', async () => {
  const { controller, view } = await setup()
  const { containerEl } = liveView()
  controller.sync([[{}, view(containerEl)]])
  await vi.waitFor(() => expect(headers(containerEl)).toHaveLength(1))
  controller.dispose()
  expect(containerEl.querySelector('.saga-header-host')).toBeNull()
  expect(containerEl.classList.contains('saga-header-active')).toBe(false)
})

test('a pending text edit is written to its own note when the leaf switches files', async () => {
  const { controller, app, file } = await setup()
  const bob = app.addFile('Characters/Bob.md', '---\ntype: character\ntitle: Fixer\nlocation: "[[Waterdeep]]"\n---\n')
  const { containerEl } = liveView()
  const leaf = {}
  controller.sync([[leaf, { containerEl, file, mode: 'live' }]])
  await vi.waitFor(() => expect(headers(containerEl)).toHaveLength(1))
  const title = containerEl.querySelector<HTMLTextAreaElement>('[data-field="title"] textarea')
  title?.focus()
  await userEvent.keyboard('X')
  controller.sync([[leaf, { containerEl, file: bob, mode: 'live' }]])
  await vi.waitFor(() => expect(app.text(ada)).toContain('title: XMathematician'))
  expect(app.text('Characters/Bob.md')).toContain('title: Fixer\n')
  expect(containerEl.querySelector<HTMLTextAreaElement>('[data-field="title"] textarea')?.value).toBe('Fixer')
})

test('a document note mounts a header while it has a banner, and unmounts when it has none', async () => {
  const { controller, view, app } = await setup('---\ntype: note\nbanner: "[[coast.jpg]]"\n---\n')
  const { containerEl } = liveView()
  const leaf = {}
  controller.sync([[leaf, view(containerEl)]])
  await vi.waitFor(() => expect(headers(containerEl)).toHaveLength(1))
  expect(containerEl.classList.contains('saga-header-active')).toBe(true)

  app.addFile(ada, '---\ntype: note\n---\n')
  controller.sync([[leaf, view(containerEl)]])
  expect(containerEl.querySelector('.saga-header-host')).toBeNull()
  expect(containerEl.classList.contains('saga-header-active')).toBe(false)
})
