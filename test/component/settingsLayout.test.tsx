import { afterEach, expect, test } from 'vitest'
import '../../src/settings/settings.css'

afterEach(() => document.body.replaceChildren())

/** Pin rows as `Setting` builds them: info, then a control holding preview, Shape, Colour, Icon and Reset. */
function pinRows(width: string, looks: readonly (readonly [string, string])[]) {
  const rows = document.body.appendChild(document.createElement('div'))
  rows.className = 'saga-pin-rows'
  rows.style.width = width
  for (const [shape, color] of looks) {
    const row = rows.appendChild(document.createElement('div'))
    row.className = 'setting-item'
    row.innerHTML = `<div class="setting-item-info"><div class="setting-item-name">Character</div></div><div class="setting-item-control"><div class="saga-pin-preview"><svg viewBox="0 0 32 44"></svg></div><select class="dropdown"><option>${shape}</option></select><select class="dropdown"><option>${color}</option></select><div class="extra-setting-button" style="width:24px;height:24px"></div><div class="extra-setting-button" style="width:24px;height:24px"></div></div>`
  }
  return [...rows.children].map((row) =>
    [...row.querySelectorAll('.setting-item-name, .saga-pin-preview, select, .extra-setting-button')].map((el) => el.getBoundingClientRect())
  )
}

test('pin rows share columns: each control starts and ends at the same x on every row, centred on the row', () => {
  const rows = pinRows('800px', [
    ['Pin', 'Crimson'],
    ['Herald', 'Teal']
  ])
  const [a, b] = rows.map((boxes) => boxes.slice(1).map((box) => [box.left, box.right]))
  expect(a).toEqual(b)
  for (const boxes of rows) {
    const centres = boxes.map((box) => Math.round(box.top + box.height / 2))
    expect(new Set(centres).size).toBe(1)
  }
})

test('in a narrow container the name sits above the controls, which keep one line', () => {
  const boxes = pinRows('300px', [['Bookmark', 'Crimson']])[0]!
  const name = boxes[0]!
  const controls = boxes.slice(1)
  for (const box of controls) expect(box.top).toBeGreaterThanOrEqual(name.bottom)
  expect(new Set(controls.map((box) => Math.round(box.top + box.height / 2))).size).toBe(1)
  expect(Math.max(...controls.map((box) => box.right))).toBeLessThanOrEqual(name.right + 1)
})

test('a renderer card\'s chevron turns when the card opens', () => {
  const card = document.body.appendChild(document.createElement('div'))
  card.className = 'setting-group saga-settings-renderer'
  card.innerHTML = '<details class="setting-items"><summary class="setting-item"><div class="setting-item-control saga-settings-chevron"></div></summary></details>'
  const chevron = card.querySelector('.saga-settings-chevron')!
  expect(getComputedStyle(chevron).transform).toBe('none')
  card.querySelector('details')!.open = true
  chevron.getAnimations().forEach((animation) => animation.finish())
  expect(getComputedStyle(chevron).transform).toBe('matrix(0, 1, -1, 0, 0, 0)')
})
