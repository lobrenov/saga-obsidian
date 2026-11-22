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
    expect(pins.map((pin) => [pin.file.path, pin.index, pin.renderer, pin.look, pin.x, pin.y])).toEqual([
      ['Places/Saltmere.md', 0, 'location', { shape: 'pin', color: 'teal', icon: 'castle' }, 790, 500],
      ['People/The Gull King.md', 0, 'character', { shape: 'pin', color: 'crimson', icon: 'skull' }, 300, 590],
      ['Places/The Brine Vaults.md', 0, 'location', { shape: 'pin', color: 'teal', icon: 'castle' }, 846, 556]
    ])
  })

  it('reports an unknown style as an issue and takes the renderer look', () => {
    const [brine] = collectPins(fake.app, fake.settings, [fake.file('Places/The Brine Vaults.md')], fake.file(MAP))
    expect(brine?.look.icon).toBe('castle')
    expect(brine?.issues).toEqual(['Unknown pin style "sparkly"; using auto'])
  })

  it('resolves the look over the pin defaults of the config and keeps those defaults on the pin', async () => {
    fake.fake.setRaw(CONFIG_PATH, 'typeKey: type\nrenderers:\n  location:\n    types: [settlement]\n    pin: { shape: flag, color: sea }\n')
    await fake.settings.reload()
    fake.addNote('Places/Own.md', '---\ntype: settlement\nmap-pins:\n  - map: "[[The Shattered Coast]]"\n    x: 1\n    y: 2\n    color: rust\n---\n')
    const [saltmere, own] = collectPins(fake.app, fake.settings, [fake.file('Places/Saltmere.md'), fake.file('Places/Own.md')], fake.file(MAP))
    expect(saltmere?.look).toEqual({ shape: 'flag', color: 'sea', icon: 'castle' })
    expect(own?.look).toEqual({ shape: 'flag', color: 'rust', icon: 'castle' })
    expect(own?.defaults).toEqual({ shape: 'flag', color: 'sea', icon: 'castle' })
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

  it('takes the layers panel from the option, on unless switched off, and the pin labels from the setting', () => {
    expect(fake.state()).toMatchObject({ labels: 'always', layers: true })
    fake.options['layers'] = false
    fake.pinLabels = 'hover'
    expect(fake.state()).toMatchObject({ labels: 'hover', layers: false })
  })

  it('shows only the pins of the notes the base lists', () => {
    const state = mapStateOf(fake.app, fake.settings, { option: (key) => fake.options[key], pinLabels: 'always', files: () => [fake.file('Places/Saltmere.md')], host: (map) => createHost(fake.app, map, { pickNote: () => Promise.resolve(null), pickIcon: () => Promise.resolve(null), confirmRemove: () => Promise.resolve(true), notify: () => {}, hoverNote: () => {}, showMenu: () => {} }) })
    expect(state.kind === 'map' && state.pins.map((pin) => pin.title)).toEqual(['Saltmere'])
  })
})
