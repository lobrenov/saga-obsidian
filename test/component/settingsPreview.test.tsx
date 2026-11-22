import { afterEach, expect, test } from 'vitest'
import { drawPinPreview } from '../../src/settings/pinPreview'
import { SHAPES } from '../../src/shared/pins/look'
import { unknownIcons } from '../fakes/obsidian'
import '../../src/settings/settings.css'

afterEach(() => {
  document.body.replaceChildren()
  document.body.classList.remove('theme-dark')
  unknownIcons.clear()
})

function preview() {
  const el = document.body.appendChild(document.createElement('div'))
  el.className = 'saga-pin-preview'
  return el
}

test('the preview draws the map\'s pin: outlined shape in the colour, the icon in a class-less svg in the shape\'s icon box', () => {
  const el = preview()
  drawPinPreview(el, { shape: 'flag', color: 'rust', icon: 'skull' })
  const shape = SHAPES.find((s) => s.id === 'flag')!
  const path = el.querySelector('path')!
  expect(path.getAttribute('fill')).toBe('var(--saga-pin-rust)')
  expect(path.getAttribute('stroke')).toBe('#fbf8f2')
  expect(path.getAttribute('stroke-width')).toBe('2')
  const glyph = el.querySelector(':scope > svg > svg')!
  expect(glyph.getAttribute('class')).toBeNull()
  expect(glyph.querySelector('[data-icon="skull"]')).not.toBeNull()
  expect(['x', 'y', 'width', 'height', 'viewBox'].map((a) => glyph.getAttribute(a))).toEqual([String(shape.ix), String(shape.iy), String(shape.is), String(shape.is), '0 0 24 24'])
  expect(glyph.getBoundingClientRect().width).toBeLessThan(el.getBoundingClientRect().width)
})

test('an icon Obsidian does not know draws the fallback; the glyph is light, and ink on dark themes', () => {
  unknownIcons.add('bogus')
  const el = preview()
  drawPinPreview(el, { shape: 'pin', color: 'rust', icon: 'bogus' })
  const glyph = el.querySelector(':scope > svg > svg')!
  expect(glyph.querySelector('[data-icon="circle-small"]')).not.toBeNull()
  expect(getComputedStyle(glyph).color).toBe('rgb(251, 248, 242)')
  document.body.classList.add('theme-dark')
  expect(getComputedStyle(glyph).color).toBe('rgb(30, 26, 22)')
})
