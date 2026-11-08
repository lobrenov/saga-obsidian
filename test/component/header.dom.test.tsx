import { afterEach, expect, test } from 'vitest'
import { liveView, readingView } from './header.support'
import { ACTIVE_CLASS, PROPERTIES_CLASS, isolatePointer, markActive, placeHost } from '../../src/header/dom'

afterEach(() => document.body.replaceChildren())

test('Live Preview: the host goes before .inline-title inside .cm-sizer', () => {
  const { containerEl, sizer } = liveView()
  const host = document.createElement('div')
  expect(placeHost(containerEl, host, 'live')).toBe(true)
  expect(host.parentElement).toBe(sizer)
  expect(host.nextElementSibling?.className).toBe('inline-title')
})

test('Live Preview without an inline title: the host is the first child of .cm-sizer', () => {
  const { containerEl, sizer } = liveView({ inlineTitle: false })
  const host = document.createElement('div')
  placeHost(containerEl, host, 'live')
  expect(sizer.firstElementChild).toBe(host)
})

test('Reading view: the host goes before .mod-header inside .markdown-preview-sizer', () => {
  const { containerEl, sizer } = readingView()
  const host = document.createElement('div')
  expect(placeHost(containerEl, host, 'reading')).toBe(true)
  expect(host.parentElement).toBe(sizer)
  expect(host.nextElementSibling?.className).toBe('mod-header')
})

test('Reading view without .mod-header: the host is the first child', () => {
  const { containerEl, sizer } = readingView()
  sizer.querySelector('.mod-header')?.remove()
  const host = document.createElement('div')
  placeHost(containerEl, host, 'reading')
  expect(sizer.firstElementChild).toBe(host)
})

test('placing is idempotent and moves a host that drifted', () => {
  const { containerEl, sizer } = liveView()
  const host = document.createElement('div')
  placeHost(containerEl, host, 'live')
  const mutations: MutationRecord[] = []
  const observer = new MutationObserver((records) => mutations.push(...records))
  observer.observe(sizer, { childList: true })
  placeHost(containerEl, host, 'live')
  expect(observer.takeRecords()).toHaveLength(0)
  sizer.append(host)
  placeHost(containerEl, host, 'live')
  expect(host.nextElementSibling?.className).toBe('inline-title')
  observer.disconnect()
})

test('a mode only finds its own sizer', () => {
  const { containerEl } = liveView()
  expect(placeHost(containerEl, document.createElement('div'), 'reading')).toBe(false)
  const empty = document.createElement('div')
  expect(placeHost(empty, document.createElement('div'), 'live')).toBe(false)
})

test('markActive sets the active class and the properties class only while active', () => {
  const el = document.createElement('div')
  markActive(el, true)
  expect([...el.classList]).toEqual([ACTIVE_CLASS])
  markActive(el, true, true)
  expect(el.classList.contains(PROPERTIES_CLASS)).toBe(true)
  markActive(el, false, true)
  expect(el.classList.length).toBe(0)
})

test('isolatePointer stops mousedown and click at the host but lets keys through', () => {
  const outer = document.createElement('div')
  const host = document.createElement('div')
  const inner = document.createElement('button')
  host.append(inner)
  outer.append(host)
  document.body.append(outer)
  isolatePointer(host)
  const seen: string[] = []
  for (const type of ['mousedown', 'click', 'keydown']) outer.addEventListener(type, () => seen.push(type))
  inner.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  inner.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  inner.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
  expect(seen).toEqual(['keydown'])
})
