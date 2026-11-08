import { expect, test, vi } from 'vitest'
import { GULL, MAP, type MapFake } from '../fakes/map'
import { clickMapAt, clusters, color, imageBox, marker, markers, renderMap, stage, tipOf } from './mapSupport'

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
  await expect.element(screen.getByRole('button', { name: 'Saltmere — Location' })).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'The Gull King — Character, danger' })).toBeVisible()
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

test('pins are coloured by their note renderer whatever their style, which shows only as a glyph; an unknown style is an issue on the card', async () => {
  const { screen } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  expect(color(marker('Saltmere'))).toContain('--saga-map-pin:var(--saga-location)')
  expect(color(marker('The Gull King'))).toContain('--saga-map-pin:var(--saga-character)')
  expect(color(marker('The Brine Vaults'))).toContain('--saga-map-pin:var(--saga-location)')
  expect(marker('The Gull King').innerHTML).toMatch(/#saga-map-sprite-\d+-glyph-danger/)
  expect(marker('Saltmere').innerHTML).toMatch(/#saga-map-sprite-\d+-glyph-auto/)

  await screen.getByRole('button', { name: 'The Brine Vaults — Location' }).click()
  const card = screen.getByRole('dialog', { name: 'The Brine Vaults' })
  await expect.element(card).toBeVisible()
  expect(card.element().textContent).toContain('Pin saved in The Brine Vaults.md → map-pins')
  expect(card.getByRole('list', { name: 'Problems with this pin' }).element().textContent).toContain('Unknown pin style "sparkly"; using auto')
  await expect.element(card.getByLabelText('Style')).toHaveValue('auto')
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

test('layer toggles hide pins by renderer and by style', async () => {
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

test('the layers and labels options switch the panel and the pin labels', async () => {
  const { screen } = await renderMap((fake) => {
    fake.options['layers'] = false
    fake.options['labels'] = false
  })
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  expect(screen.getByRole('checkbox', { name: /Locations/ }).elements()).toHaveLength(0)
  expect(document.querySelectorAll('.saga-map-label')).toHaveLength(0)
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
  marker('D').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  await vi.waitFor(() => expect(document.querySelectorAll('.saga-map-label-top .saga-map-label')).toHaveLength(1))
  expect(document.querySelector('.saga-map-label-top')?.textContent).toBe('D')
})

test('a style shows as the pin glyph and in the Layers panel as the same glyph in a neutral colour', async () => {
  await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  expect(document.querySelectorAll('.saga-map-glyph').length).toBeGreaterThan(0)
  expect(document.querySelector('.saga-map-layers .saga-map-dot')).not.toBeNull()
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
  await screen.getByRole('button', { name: 'Saltmere — Location' }).click()
  const card = screen.getByRole('dialog', { name: 'Saltmere' })
  await expect.element(card).toBeVisible()
  expect(marker('Saltmere').className).toContain('saga-map-pin-selected')
  await screen.getByRole('button', { name: 'The Gull King — Character, danger' }).click()
  await expect.element(screen.getByRole('dialog', { name: 'The Gull King' })).toBeVisible()
  expect(screen.getByRole('dialog', { name: 'Saltmere' }).elements()).toHaveLength(0)
  clickMapAt(50, 700)
  await vi.waitFor(() => expect(screen.getByRole('dialog').elements()).toHaveLength(0))

  await screen.getByRole('button', { name: 'Saltmere — Location' }).click()
  await expect.element(screen.getByRole('dialog', { name: 'Saltmere' })).toBeVisible()
  stage()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await vi.waitFor(() => expect(screen.getByRole('dialog').elements()).toHaveLength(0))
})

test('the card shows an excerpt of the note and Open note opens it, in a new tab with ⌘ or Ctrl', async () => {
  const { screen, fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await screen.getByRole('button', { name: 'Saltmere — Location' }).click()
  const card = screen.getByRole('dialog', { name: 'Saltmere' })
  await vi.waitFor(() => expect(card.element().textContent).toContain('A harbour town that taxes the tide.'))
  await card.getByRole('button', { name: 'Open note' }).click()
  expect(fake.opened).toEqual([{ linktext: 'Places/Saltmere.md', sourcePath: MAP, newLeaf: false }])
  card.getByRole('button', { name: 'Open note' }).element().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }))
  expect(fake.opened[1]).toMatchObject({ linktext: 'Places/Saltmere.md', newLeaf: 'tab' })
})

test('hovering a pin asks for the note\'s hover preview', async () => {
  const { fake } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  marker('The Gull King').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  expect(fake.hovered).toContain('People/The Gull King.md')
})

test('the pin list is sorted by title and opens the card of a pin', async () => {
  const { screen } = await renderMap()
  await vi.waitFor(() => expect(markers()).toHaveLength(3))
  await screen.getByRole('button', { name: /Pins ·/ }).click()
  const list = screen.getByRole('complementary', { name: 'Pins on this map' })
  const rows = list
    .getByRole('listitem')
    .elements()
    .map((el) => el.querySelector('.saga-map-pin-row-title')?.textContent)
  expect(rows).toEqual(['Saltmere', 'The Brine Vaults', 'The Gull King'])
  await list.getByRole('button', { name: /^Saltmere/ }).click()
  const card = screen.getByRole('dialog', { name: 'Saltmere' })
  await expect.element(card).toBeVisible()
  await vi.waitFor(() => expect(card.element().contains(document.activeElement)).toBe(true))
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
