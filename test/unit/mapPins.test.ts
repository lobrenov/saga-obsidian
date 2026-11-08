import { beforeEach, describe, expect, it } from 'vitest'
import { createHost } from '../../src/map/host'
import { mapStateOf } from '../../src/map/mapState'
import { collectPins, mapLinkFrom } from '../../src/map/pins'
import { CONFIG_PATH } from '../../src/obsidian/vault'
import { GULL, MAP, MapFake } from '../fakes/map'

let fake: MapFake
beforeEach(async () => {
  fake = await MapFake.create()
})

const files = () => fake.base.map((path) => fake.file(path))

describe('collectPins', () => {
  it('lists the entries whose map link resolves to the map, with the renderer of their note', () => {
    const pins = collectPins(fake.app, fake.settings, files(), fake.file(MAP))
    expect(pins.map((pin) => [pin.file.path, pin.index, pin.renderer, pin.style, pin.x, pin.y])).toEqual([
      ['Places/Saltmere.md', 0, 'location', 'auto', 790, 500],
      ['People/The Gull King.md', 0, 'character', 'danger', 300, 590],
      ['Places/The Brine Vaults.md', 0, 'location', 'auto', 846, 556]
    ])
  })

  it('reports an unknown style as an issue and falls back to auto', () => {
    const [brine] = collectPins(fake.app, fake.settings, [fake.file('Places/The Brine Vaults.md')], fake.file(MAP))
    expect(brine?.style).toBe('auto')
    expect(brine?.issues).toEqual(['Unknown pin style "sparkly"; using auto'])
  })

  it('skips notes outside the given files, other maps, invalid entries and the map note itself', () => {
    fake.addNote('Maps/Other.md', '---\ntype: map\n---\n')
    fake.addNote('Places/Port.md', '---\ntype: location\nmap-pins:\n  - map: "[[Other]]"\n    x: 1\n    y: 1\n  - map: "[[The Shattered Coast]]"\n    x: oops\n    y: 1\n---\n')
    fake.addNote('Places/Outside.md', GULL.replace('The Gull King', 'x'), false)
    const pins = collectPins(fake.app, fake.settings, files(), fake.file(MAP))
    expect(pins.map((pin) => pin.file.path)).toEqual(['Places/Saltmere.md', 'People/The Gull King.md', 'Places/The Brine Vaults.md'])
  })

  it('resolves the map link from the note that holds it', () => {
    fake.addNote('Archive/Coast.md', '---\ntype: map\nimage: "[[coast.svg]]"\n---\n')
    fake.addNote('Archive/Fort.md', '---\ntype: location\nmap-pins:\n  - map: "[[Coast]]"\n    x: 1\n    y: 2\n---\n')
    expect(mapLinkFrom(fake.app, fake.file(MAP), fake.file('Archive/Fort.md'))).toBe('[[The Shattered Coast]]')
    const archive = collectPins(fake.app, fake.settings, [fake.file('Archive/Fort.md')], fake.file('Archive/Coast.md'))
    expect(archive).toHaveLength(1)
  })

  it('colours by the renderer a renamed type resolves to', async () => {
    fake.fake.setRaw(CONFIG_PATH, 'typeKey: type\nrenderers:\n  faction:\n    types: [settlement]\n')
    await fake.settings.reload()
    const [saltmere] = collectPins(fake.app, fake.settings, [fake.file('Places/Saltmere.md')], fake.file(MAP))
    expect(saltmere?.renderer).toBe('faction')
  })
})

describe('mapStateOf', () => {
  it('shows each empty state', () => {
    expect(fake.state()).toMatchObject({ kind: 'map', title: 'The Shattered Coast' })
    fake.options['map'] = undefined
    expect(fake.state()).toEqual({ kind: 'empty', message: 'Choose a map note in the view options.' })
    fake.options['map'] = 'Maps/Gone.md'
    expect(fake.state()).toMatchObject({ kind: 'empty', message: 'Maps/Gone.md is not in the vault.' })
    fake.options['map'] = 'People/Mother Hesk.md'
    expect(fake.state()).toMatchObject({ kind: 'empty', message: 'Mother Hesk is not a map note.' })
    fake.addNote('Maps/Blank.md', '---\ntype: map\n---\n')
    fake.options['map'] = 'Maps/Blank.md'
    expect(fake.state()).toMatchObject({ kind: 'empty', message: expect.stringContaining('has no image') as string })
    fake.addNote('Maps/Lost.md', '---\ntype: map\nimage: "[[missing.png]]"\n---\n')
    fake.options['map'] = 'Maps/Lost.md'
    expect(fake.state()).toMatchObject({ kind: 'empty', message: expect.stringContaining('has no image') as string })
  })

  it('accepts the chosen map as a path, a link or a bare name', () => {
    for (const value of ['Maps/The Shattered Coast.md', '[[The Shattered Coast]]', '[[Maps/The Shattered Coast|coast]]', 'The Shattered Coast']) {
      fake.options['map'] = value
      expect(fake.state()).toMatchObject({ kind: 'map', title: 'The Shattered Coast' })
    }
  })

  it('reuses the host while the map is unchanged', () => {
    const host = (fake.state() as { host: unknown }).host
    fake.addNote('Places/Saltmere.md', 'x')
    expect((fake.state() as { host: unknown }).host).toBe(host)
  })

  it('reads the image from the key the config renames it to', async () => {
    fake.addNote('Maps/Renamed.md', '---\ntype: map\nmap-image: "[[coast.svg]]"\n---\n')
    fake.options['map'] = 'Maps/Renamed.md'
    expect(fake.state().kind).toBe('empty')
    fake.fake.setRaw(CONFIG_PATH, 'typeKey: type\nrenderers:\n  map:\n    types: [map]\n    keys: { image: map-image }\n')
    await fake.settings.reload()
    expect(fake.state()).toMatchObject({ kind: 'map', title: 'Renamed' })
  })

  it('takes labels and layers from the options, on unless switched off', () => {
    expect(fake.state()).toMatchObject({ labels: true, layers: true })
    fake.options['labels'] = false
    fake.options['layers'] = false
    expect(fake.state()).toMatchObject({ labels: false, layers: false })
  })

  it('shows only the pins of the notes the base lists', () => {
    const state = mapStateOf(fake.app, fake.settings, { option: (key) => fake.options[key], files: () => [fake.file('Places/Saltmere.md')], host: (map) => createHost(fake.app, map, { pickNote: () => Promise.resolve(null), confirmRemove: () => Promise.resolve(true), notify: () => {}, hoverNote: () => {} }) })
    expect(state.kind === 'map' && state.pins.map((pin) => pin.title)).toEqual(['Saltmere'])
  })
})
