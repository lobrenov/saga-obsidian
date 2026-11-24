import { expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LayersPanel } from '../../src/map/LayersPanel'
import type { PlacedPin } from '../../src/map/types'
import { CONFIG_PATH } from '../../src/obsidian/vault'
import { SHAPES } from '../../src/shared/pins/look'
import type { RendererId } from '../../src/shared/renderers/ids'
import { unknownIcons } from '../fakes/obsidian'
import { CONFIG_YAML, GULL, MAP, type MapFake } from '../fakes/map'
import { clickMapAt, clusters, color, glyphOf, imageBox, marker, markers, renderMap, shapeOf, stage, tipOf } from './mapSupport'

const pinsOnEveryNote = (count: number) => (fake: MapFake) => {
  for (let i = 0; i < count; i++) {
    const x = 100 + (i % 10) * 4
    const y = 100 + Math.floor(i / 10) * 4
    fake.addNote(`Places/P${i}.md`, `---\ntype: location\nmap-pins:\n  - map: "[[The Shattered Coast]]"\n    x: ${x}\n    y: ${y}\n---\n`)
  }
}

test('the map image is drawn and a pin stands at its image point for every listed note that points at the map', async () => {
  const { screen } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  expect(document.querySelector('img[data-map-image]')?.getAttribute('src')).toMatch(/^data:image\/svg/)
  await expect.element(screen.getByRole('button', { name: 'Saltmere — Location, Castle' })).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'The Gull King — Character, Danger' })).toBeVisible()
  await vi.waitFor(() => {
    const image = imageBox()
    const tip = tipOf(marker('Saltmere'))
    expect(tip.x).toBeCloseTo(image.left + 790 * image.scale, 0)
    expect(tip.y).toBeCloseTo(image.top + 500 * image.scale, 0)
  })
})

test('a pin of a note the base does not list is not shown', async () => {
  await renderMap((fake) => {
    fake.addNote('Places/Hidden.md', '---\ntype: location\nmap-pins:\n  - map: "[[The Shattered Coast]]"\n    x: 5\n    y: 5\n---\n', false)
  })
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  expect(markers().some((el) => el.textContent?.startsWith('Hidden'))).toBe(false)
})

test('a pin takes its look from its entry, else its renderer defaults; a style reads as its icon; an unknown style is an issue on the card', async () => {
  const { screen } = await renderMap((fake) => {
    fake.addNote('Places/Ember.md', '---\ntype: settlement\nmap-pins:\n  - map: "[[The Shattered Coast]]"\n    x: 50\n    y: 60\n    shape: herald\n    color: rust\n    icon: flame\n---\n')
  })
  await vi.waitFor(() => expect(markers()).toHaveLength(4))
  expect([shapeOf(marker('Saltmere')), glyphOf(marker('Saltmere')), color(marker('Saltmere'))]).toEqual(['pin', 'castle', '--saga-map-pin:var(--saga-pin-teal)'])
  expect([shapeOf(marker('The Gull King')), glyphOf(marker('The Gull King')), color(marker('The Gull King'))]).toEqual(['pin', 'skull', '--saga-map-pin:var(--saga-pin-crimson)'])
  expect([shapeOf(marker('Ember')), glyphOf(marker('Ember')), color(marker('Ember'))]).toEqual(['herald', 'flame', '--saga-map-pin:var(--saga-pin-rust)'])
  expect(glyphOf(marker('The Brine Vaults'))).toBe('castle')

  await screen.getByRole('button', { name: 'The Brine Vaults — Location, Castle' }).click()
  const card = screen.getByRole('dialog', { name: 'The Brine Vaults' })
  await expect.element(card).toBeVisible()
  expect(card.getByRole('list', { name: 'Problems with this pin' }).element().textContent).toContain('Unknown pin style "sparkly"; using auto')
  await expect.element(card.getByRole('button', { name: 'Icon' })).toHaveTextContent('Castle')
})

test('the renderer pin defaults of the config colour its pins and its Layers dot', async () => {
  await renderMap(async (fake) => {
    fake.fake.setRaw(CONFIG_PATH, CONFIG_YAML.replace('    types: [location, settlement]\n', '    types: [location, settlement]\n    pin: { shape: flag, color: sea, icon: tower-control }\n'))
    await fake.settings.reload()
  })
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  expect([shapeOf(marker('Saltmere')), glyphOf(marker('Saltmere')), color(marker('Saltmere'))]).toEqual(['flag', 'tower-control', '--saga-map-pin:var(--saga-pin-sea)'])
  expect(glyphOf(marker('The Gull King'))).toBe('skull')
  expect([...document.querySelectorAll<HTMLElement>('.saga-map-layers .saga-map-dot')].map((dot) => dot.style.background)).toEqual(['var(--saga-pin-crimson)', 'var(--saga-pin-sea)'])
})

test('the sprite has one shape symbol per shape and one glyph symbol per icon in use; an icon Obsidian does not know draws the dot', async () => {
  unknownIcons.add('castle')
  try {
    await renderMap()
    await vi.waitFor(() => expect(markers()).toHaveLength(3))
    const ids = (kind: string): string[] => [...document.querySelectorAll('symbol')].map((symbol) => symbol.id).filter((id) => id.includes(`-${kind}-`)).map((id) => id.split(`-${kind}-`)[1] ?? '')
    expect(ids('shape')).toEqual(SHAPES.map((shape) => shape.id))
    expect(ids('glyph').sort()).toEqual(['castle', 'circle-small', 'skull'])
    expect(document.querySelector('symbol[id$="-glyph-castle"] [data-icon]')?.getAttribute('data-icon')).toBe('circle-small')
    expect(document.querySelector('symbol[id$="-glyph-skull"] [data-icon]')?.getAttribute('data-icon')).toBe('skull')
  } finally {
    unknownIcons.clear()
  }
})

test.each(SHAPES)('a $id pin stands on its shape anchor at every zoom level', async ({ id }) => {
  await renderMap((fake) => {
    fake.addNote('Places/Mark.md', `---\ntype: location\nmap-pins:\n  - map: "[[The Shattered Coast]]"\n    x: 400\n    y: 300\n    shape: ${id}\n---\n`)
  })
  await vi.waitFor(() => expect(markers()).toHaveLength(4))
  const stood = (): void => {
    const image = imageBox()
    const tip = tipOf(marker('Mark'), id)
    expect(tip.x).toBeCloseTo(image.left + 400 * image.scale, 0)
    expect(tip.y).toBeCloseTo(image.top + 300 * image.scale, 0)
  }
  await vi.waitFor(stood)
  const at = tipOf(marker('Mark'), id)
  stage()!.dispatchEvent(new WheelEvent('wheel', { deltaY: -250, ctrlKey: true, clientX: at.x, clientY: at.y, bubbles: true, cancelable: true }))
  const scale = imageBox().scale
  await vi.waitFor(() => expect(imageBox().scale).toBeGreaterThan(scale * 1.2))
  await vi.waitFor(stood)
})

test('layer toggles hide pins by renderer and by icon', async () => {
  const { screen } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await expect.element(screen.getByRole('checkbox', { name: /Locations/ })).toBeChecked()
  await screen.getByRole('checkbox', { name: /Locations/ }).click()
  await vi.waitFor(() => expect(markers().map((m) => m.dataset['pin'])).toEqual(['People/The Gull King.md#0']))
  await screen.getByRole('checkbox', { name: /Locations/ }).click()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await screen.getByRole('checkbox', { name: /^Danger/ }).click()
  await vi.waitFor(() => expect(markers()).toHaveLength(2))
})

test('two map views in one window draw from their own sprites', async () => {
  await renderMap()
  const first = marker('Saltmere').querySelector('use')?.getAttribute('href')
  const { screen } = await renderMap()
  await vi.waitFor(() => expect(screen.container.querySelectorAll('[data-pin]')).toHaveLength(3))
  const second = screen.container.querySelector('[data-pin] use')?.getAttribute('href')
  expect(second).not.toBe(first)
  expect(document.querySelectorAll(`[id="${second?.slice(1)}"]`)).toHaveLength(1)
})

test('the layers option hides the panel', async () => {
  const { screen } = await renderMap((fake) => void (fake.options['layers'] = false))
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  expect(screen.getByRole('checkbox', { name: /Locations/ }).elements()).toHaveLength(0)
})

test('in hover mode a label shows only for the pin under the pointer or with focus', async () => {
  await renderMap((fake) => void (fake.pinLabels = 'hover'))
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  expect(document.querySelectorAll('.saga-map-label')).toHaveLength(0)
  marker('Saltmere').dispatchEvent(new MouseEvent('mouseenter'))
  await vi.waitFor(() => expect(document.querySelectorAll('.saga-map-label')).toHaveLength(1))
  expect(document.querySelector('.saga-map-label')?.textContent).toBe('Saltmere')
  marker('Saltmere').dispatchEvent(new MouseEvent('mouseleave'))
  await vi.waitFor(() => expect(document.querySelectorAll('.saga-map-label')).toHaveLength(0))
  marker('The Gull King').focus()
  await vi.waitFor(() => expect(document.querySelector('.saga-map-label')?.textContent).toBe('The Gull King'))
})

test('labels sit beside their pins, and one with no free slot shows on hover, on top of the pins', async () => {
  await renderMap((fake) => {
    for (const name of ['A', 'B', 'C', 'D']) fake.addNote(`Places/${name}.md`, '---\ntype: location\nmap-pins:\n  - map: "[[The Shattered Coast]]"\n    x: 400\n    y: 200\n---\n')
  })
  await vi.waitFor(() => expect(markers()).toHaveLength(7))
  await vi.waitFor(() => expect(document.querySelectorAll('.saga-map-label')).toHaveLength(6))
  const labels = [...document.querySelectorAll<HTMLElement>('.saga-map-label')]
  for (const label of labels) {
    const box = label.getBoundingClientRect()
    for (const pin of markers()) {
      const pinBox = pin.getBoundingClientRect()
      expect(box.right <= pinBox.left || box.left >= pinBox.right || box.bottom <= pinBox.top || box.top >= pinBox.bottom).toBe(true)
    }
  }
  expect(document.querySelectorAll('.saga-map-label-top')).toHaveLength(0)
  marker('D').dispatchEvent(new MouseEvent('mouseenter'))
  await vi.waitFor(() => expect(document.querySelectorAll('.saga-map-label-top .saga-map-label')).toHaveLength(1))
  expect(document.querySelector('.saga-map-label-top')?.textContent).toBe('D')
})

test('the Layers panel lists the icons in use with their glyphs and the renderers with a dot in their pin colour', async () => {
  await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  const group = document.querySelector('[aria-label="By icon"]')!
  expect([...group.querySelectorAll('.saga-map-layer-name')].map((el) => el.textContent)).toEqual(['Castle', 'Danger'])
  expect(group.querySelectorAll('svg.saga-map-glyph use[href*="-glyph-"]')).toHaveLength(2)
  expect(document.querySelector('[aria-label="By style"]')).toBeNull()
  expect([...document.querySelectorAll<HTMLElement>('.saga-map-layers .saga-map-dot')].map((dot) => dot.style.background)).toEqual(['var(--saga-pin-crimson)', 'var(--saga-pin-teal)'])
})

test('above the threshold pins merge into clusters that zoom in when activated', async () => {
  const { screen } = await renderMap(pinsOnEveryNote(60))
  const shown = (): number => markers().length + clusters().length
  await vi.waitFor(() => expect(clusters().length).toBeGreaterThan(0))
  expect(shown()).toBeLessThan(10)
  const before = shown()
  expect(clusters()[0]?.dataset['mapCluster']).toMatch(/^\d+$/)
  ;(screen.getByRole('button', { name: /pins here, zoom in/ }).first().element() as HTMLElement).click()
  await vi.waitFor(() => expect(shown()).toBeGreaterThan(before))
})

test('pins far outside the view are culled but stay focusable', async () => {
  await renderMap((fake) => {
    fake.addNote('Places/Far.md', '---\ntype: location\nmap-pins:\n  - map: "[[The Shattered Coast]]"\n    x: 1399\n    y: 899\n---\n')
  })
  await vi.waitFor(() => expect(markers()).toHaveLength(4))
  const far = marker('Far')
  const view = stage()!
  // Zoom in on the top left so the far corner is well outside the view.
  view.dispatchEvent(new WheelEvent('wheel', { deltaY: -600, ctrlKey: true, clientX: view.getBoundingClientRect().left, clientY: view.getBoundingClientRect().top, bubbles: true, cancelable: true }))
  await vi.waitFor(() => expect(far.hasAttribute('data-culled')).toBe(true))
  far.focus()
  await vi.waitFor(() => expect(far.hasAttribute('data-culled')).toBe(false))
})

test('a click on a pin selects it and opens its card; a click on the map or Escape closes it', async () => {
  const { screen } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await screen.getByRole('button', { name: 'Saltmere — Location, Castle' }).click()
  const card = screen.getByRole('dialog', { name: 'Saltmere' })
  await expect.element(card).toBeVisible()
  await screen.getByRole('button', { name: 'The Gull King — Character, Danger' }).click()
  await expect.element(screen.getByRole('dialog', { name: 'The Gull King' })).toBeVisible()
  expect(screen.getByRole('dialog', { name: 'Saltmere' }).elements()).toHaveLength(0)
  clickMapAt(50, 700)
  await vi.waitFor(() => expect(screen.getByRole('dialog').elements()).toHaveLength(0))

  await screen.getByRole('button', { name: 'Saltmere — Location, Castle' }).click()
  await expect.element(screen.getByRole('dialog', { name: 'Saltmere' })).toBeVisible()
  stage()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await vi.waitFor(() => expect(screen.getByRole('dialog').elements()).toHaveLength(0))
})

test('the card shows an excerpt; its title opens the note, in a new tab with ⌘ or Ctrl, and shows the hover preview', async () => {
  const { screen, fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await screen.getByRole('button', { name: 'Saltmere — Location, Castle' }).click()
  const card = screen.getByRole('dialog', { name: 'Saltmere' })
  await vi.waitFor(() => expect(card.element().textContent).toContain('A harbour town that taxes the tide.'))
  expect(card.element().textContent).not.toContain('map-pins')
  expect(card.getByRole('button').elements().map((el) => el.getAttribute('aria-label') ?? el.textContent)).toEqual(['Close', 'Pin', 'Teal', 'Castle'])
  const title = card.getByRole('link', { name: 'Saltmere' })
  await title.click()
  expect(fake.opened).toEqual([{ linktext: 'Places/Saltmere.md', sourcePath: MAP, newLeaf: false }])
  title.element().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }))
  expect(fake.opened[1]).toMatchObject({ linktext: 'Places/Saltmere.md', newLeaf: 'tab' })
  title.element().dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  expect(fake.hovered).toContain('Places/Saltmere.md')
})

test('hovering a pin asks for the note\'s hover preview', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  marker('The Gull King').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  expect(fake.hovered).toContain('People/The Gull King.md')
})

test('the header shows the map name and no Pins button or list', async () => {
  const { screen } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  expect(screen.getByRole('button', { name: /Pins/ }).elements()).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Layers' }).elements()).toHaveLength(0)
  expect(screen.getByRole('complementary').elements()).toHaveLength(0)
  expect(document.querySelector('.saga-map-layers')?.classList.contains('saga-map-layers-sidebar')).toBe(false)
})

test('on mobile the Layers button opens the layers as a sidebar beside the map; hidden layers stay hidden when it closes', async () => {
  const { screen } = await renderMap((fake) => void (fake.mobile = true))
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  expect(document.querySelector('.saga-map-layers')).toBeNull()
  const button = screen.getByRole('button', { name: 'Layers' })
  await expect.element(button).toHaveAttribute('aria-expanded', 'false')
  await button.click()
  await expect.element(button).toHaveAttribute('aria-expanded', 'true')
  const sidebar = document.querySelector<HTMLElement>('.saga-map-layers')!
  expect(sidebar.classList.contains('saga-map-layers-sidebar')).toBe(true)
  const map = document.querySelector('.saga-map-canvas-wrap')!.getBoundingClientRect()
  expect(sidebar.getBoundingClientRect().left).toBeGreaterThanOrEqual(map.right - 1)
  await screen.getByRole('checkbox', { name: /Characters/ }).click()
  await vi.waitFor(() => expect(markers()).toHaveLength(2))
  await button.click()
  expect(document.querySelector('.saga-map-layers')).toBeNull()
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(markers()).toHaveLength(2)
})

test('on mobile with the layers option off there is no Layers button', async () => {
  const { screen } = await renderMap((fake) => {
    fake.mobile = true
    fake.options['layers'] = false
  })
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  expect(screen.getByRole('button', { name: 'Layers' }).elements()).toHaveLength(0)
})

test('a note edited elsewhere moves its pin and a removed pin disappears, without reloading', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  fake.addNote('Places/Saltmere.md', '---\ntype: settlement\nmap-pins:\n  - map: "[[The Shattered Coast]]"\n    x: 100\n    y: 200\n---\n')
  await vi.waitFor(() => {
    const image = imageBox()
    const tip = tipOf(marker('Saltmere'))
    expect(tip.x).toBeCloseTo(image.left + 100 * image.scale, 0)
    expect(tip.y).toBeCloseTo(image.top + 200 * image.scale, 0)
  })
  fake.addNote('People/The Gull King.md', GULL.replace(/map-pins:[\s\S]*?(?=---\nThe)/, ''))
  await vi.waitFor(() => expect(markers()).toHaveLength(2))
})

test('a map without a choice, or without an image, says so', async () => {
  const none = await renderMap((fake) => void (fake.options['map'] = undefined), false)
  await expect.element(none.screen.getByText('Choose a map note in the view options.')).toBeVisible()
  expect(stage()).toBeNull()
})

test('a map note without an image says so', async () => {
  const { screen } = await renderMap((fake) => {
    fake.addNote('Maps/Blank.md', '---\ntype: map\n---\n')
    fake.options['map'] = 'Maps/Blank.md'
  }, false)
  await expect.element(screen.getByText(/Blank has no image/)).toBeVisible()
})

test('the By icon group stays while an icon layer is hidden, even when one icon is in use', async () => {
  const pin = (icon: string) => ({ renderer: 'location', defaults: { color: 'teal' }, look: { icon } }) as unknown as PlacedPin
  const layers = { hiddenRenderers: new Set<RendererId>(), hiddenIcons: new Set(['castle']) }
  await render(<LayersPanel pins={[pin('castle')]} layers={layers} onChange={() => {}} />)
  expect(document.querySelector('[aria-label="By icon"] input[type="checkbox"]')).not.toBeNull()
  document.body.replaceChildren()
  await render(<LayersPanel pins={[pin('castle')]} layers={{ ...layers, hiddenIcons: new Set() }} onChange={() => {}} />)
  expect(document.querySelector('[aria-label="By icon"]')).toBeNull()
})
