import type { Plugin } from 'obsidian'
import { afterEach, expect, test } from 'vitest'
import { registerFileIcons } from '../../src/explorer'
import type { Prefs, PrefsStore } from '../../src/obsidian/prefs'
import { CONFIG_PATH, createConfigStore } from '../../src/obsidian/vault'
import { FakeApp, Plugin as FakePlugin } from '../fakes/obsidian'

afterEach(() => document.body.replaceChildren())

const folder = (path: string, children = '', collapsed = true) =>
  `<div class="nav-folder"><div class="tree-item-self nav-folder-title" data-path="${path}"><div class="tree-item-icon collapse-icon${collapsed ? ' is-collapsed' : ''}"><svg class="svg-icon right-triangle"></svg></div><div class="tree-item-inner nav-folder-title-content">${path}</div></div><div class="nav-folder-children">${children}</div></div>`
const file = (path: string) => `<div class="nav-file"><div class="tree-item-self nav-file-title" data-path="${path}"><div class="tree-item-inner nav-file-title-content">${path}</div></div></div>`

async function setup(initial: Partial<Prefs> = {}) {
  const app = new FakeApp()
  app.setRaw(CONFIG_PATH, 'renderers:\n  location:\n    types: [place]\n')
  app.addFile('Characters/Ada.md', '---\ntype: character\n---\n')
  app.addFile('Places/Docks.md', '---\ntype: place\nmap-pins:\n  - { map: "[[Coast]]", x: 1, y: 2, color: plum, icon: anchor }\n---\n')
  app.addFile('Notes/Plain.md', 'text')
  app.addFile('Attachments/map.png')
  app.addFile('Maps/Coast.md', '---\ntype: map\n---\n')
  const explorer = document.body.appendChild(document.createElement('div'))
  explorer.innerHTML = folder('Characters', file('Characters/Ada.md')) + folder('Places', file('Places/Docks.md'), false) + folder('Notes', file('Notes/Plain.md')) + file('Attachments/map.png')
  app.workspace.getLeavesOfType = () => [{ view: { containerEl: explorer } }]

  let prefs: Prefs = { pinLabels: 'always', linkIcons: false, linkIconLook: 'renderer', linkTitles: false, fileIcons: true, fileIconsUntyped: true, documentCard: true, ...initial }
  const listeners = new Set<(prefs: Prefs) => void>()
  const store: PrefsStore = {
    get: () => prefs,
    set: (patch) => {
      prefs = { ...prefs, ...patch }
      listeners.forEach((callback) => callback(prefs))
      return Promise.resolve()
    },
    subscribe: (callback) => (listeners.add(callback), () => listeners.delete(callback))
  }
  const plugin = new FakePlugin(app.asApp(), { id: 'saga' })
  registerFileIcons(plugin as unknown as Plugin, await createConfigStore(app.asApp(), app.owner()), store)
  const iconOf = (path: string) => explorer.querySelector<HTMLElement>(`[data-path="${path}"] > .saga-file-icon, [data-path="${path}"] > .collapse-icon > .saga-file-icon`)
  const folderIcons = (path: string) => Array.from(iconOf(path)?.children ?? [], (el) => (el as HTMLElement).dataset.icon)
  return { app, explorer, store, plugin, iconOf, folderIcons }
}

test('folders get closed and open folder icons in their collapse icon; typed notes their renderer icon and untyped notes the document icon, before the name; other files get none', async () => {
  const { iconOf, folderIcons } = await setup()
  expect(folderIcons('Characters')).toEqual(['folder-closed', 'folder-open'])
  expect(iconOf('Characters')?.parentElement?.classList.contains('collapse-icon')).toBe(true)
  expect(iconOf('Characters/Ada.md')?.nextElementSibling?.classList.contains('tree-item-inner')).toBe(true)
  expect(iconOf('Characters/Ada.md')?.dataset).toMatchObject({ icon: 'user', renderer: 'character' })
  expect(iconOf('Places/Docks.md')?.dataset).toMatchObject({ icon: 'map-pin', renderer: 'location' })
  expect(iconOf('Notes/Plain.md')?.dataset).toMatchObject({ icon: 'file-text', renderer: 'document' })
  expect(iconOf('Attachments/map.png')).toBeNull()
})

test('a map icon look shows the note’s pin icon and colour on that map, else the renderer’s', async () => {
  const { iconOf, folderIcons } = await setup({ linkIconLook: 'Maps/Coast.md' })
  expect(iconOf('Places/Docks.md')?.dataset).toMatchObject({ icon: 'anchor', color: 'plum' })
  expect(iconOf('Characters/Ada.md')?.dataset).toMatchObject({ icon: 'user', renderer: 'character' })
  expect(iconOf('Characters/Ada.md')?.dataset.color).toBeUndefined()
  expect(folderIcons('Characters')).toEqual(['folder-closed', 'folder-open'])
})

test('untyped notes get no icon with fileIconsUntyped off', async () => {
  const { iconOf } = await setup({ fileIconsUntyped: false })
  expect(iconOf('Notes/Plain.md')).toBeNull()
  expect(iconOf('Notes')).not.toBeNull()
})

test('pref changes redraw without duplicating icons; turning it off removes them', async () => {
  const { explorer, store, iconOf } = await setup()
  await store.set({ linkIconLook: 'Maps/Coast.md' })
  expect(iconOf('Places/Docks.md')?.dataset.icon).toBe('anchor')
  await store.set({ fileIconsUntyped: false })
  expect(iconOf('Notes/Plain.md')).toBeNull()
  expect(explorer.querySelectorAll('[data-path="Places/Docks.md"] > .saga-file-icon')).toHaveLength(1)
  await store.set({ fileIcons: false })
  expect(explorer.querySelector('.saga-file-icon')).toBeNull()
})

test('rows the explorer adds later get icons', async () => {
  const { explorer, iconOf, folderIcons } = await setup()
  explorer.querySelector('[data-path="Places"] + .nav-folder-children')!.insertAdjacentHTML('beforeend', folder('Places/Docks', file('Places/Docks/Bob.md')))
  await new Promise((resolve) => setTimeout(resolve))
  expect(folderIcons('Places/Docks')).toEqual(['folder-closed', 'folder-open'])
  expect(iconOf('Places/Docks/Bob.md')).toBeNull()
})

test('a type change redraws that note; unloading removes every icon', async () => {
  const { app, explorer, plugin, iconOf } = await setup()
  app.addFile('Notes/Plain.md', '---\ntype: character\n---\n')
  expect(iconOf('Notes/Plain.md')?.dataset.icon).toBe('user')
  plugin.unload()
  expect(explorer.querySelector('.saga-file-icon')).toBeNull()
})

test('a collapsed folder shows only the closed folder icon and an expanded one only the open icon, with the arrow hidden', async () => {
  const { explorer, iconOf } = await setup()
  const shown = (path: string) =>
    Array.from(explorer.querySelectorAll<HTMLElement>(`[data-path="${path}"] > .collapse-icon > *`))
      .flatMap((el) => (el.classList.contains('saga-file-icon') ? Array.from(el.children as HTMLCollectionOf<HTMLElement>) : [el]))
      .filter((el) => getComputedStyle(el).display !== 'none')
      .map((el) => el.dataset.icon ?? el.getAttribute('class'))
  expect(shown('Characters')).toEqual(['folder-closed'])
  expect(shown('Places')).toEqual(['folder-open'])
  iconOf('Characters')!.parentElement!.classList.remove('is-collapsed')
  expect(shown('Characters')).toEqual(['folder-open'])
})

test('a file icon is vertically centred on its name', async () => {
  const style = document.head.appendChild(document.createElement('style'))
  style.textContent = ':root { --icon-s: 16px } .tree-item-self { display: flex; align-items: baseline; line-height: 1.5; font-size: 16px } .tree-item-self::before { content: "\\200b" } .saga-file-icon .svg-icon { display: block }'
  const { iconOf } = await setup()
  const icon = iconOf('Characters/Ada.md')!
  icon.innerHTML = '<svg class="svg-icon"></svg>'
  const centre = (rect: DOMRect) => rect.top + rect.height / 2
  const name = icon.nextElementSibling!.getBoundingClientRect()
  expect(Math.abs(centre(icon.firstElementChild!.getBoundingClientRect()) - centre(name))).toBeLessThan(1)
  style.remove()
})
