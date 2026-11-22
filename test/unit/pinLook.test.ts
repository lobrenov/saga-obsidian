import { describe, expect, it } from 'vitest'
import { COLOR_IDS, PIN_COLORS, PIN_DEFAULTS, PIN_ICON_CATALOG, PIN_ICONS, SHAPES, SHAPE_IDS, STYLE_ICONS, rendererLook, resolveLook } from '../../src/shared/pins/look'
import { RENDERER_IDS } from '../../src/shared/renderers/ids'

describe('resolveLook', () => {
  const location = PIN_DEFAULTS.location

  it('takes the pin\'s own keys, then its style\'s icon, then the renderer\'s look', () => {
    expect(resolveLook({}, location)).toEqual({ shape: 'pin', color: 'teal', icon: 'castle' })
    expect(resolveLook({ icon: 'key' }, location)).toEqual({ shape: 'pin', color: 'teal', icon: 'key' })
    expect(resolveLook({ shape: 'herald', color: 'rust', icon: 'skull' }, location)).toEqual({ shape: 'herald', color: 'rust', icon: 'skull' })
    expect(resolveLook({ style: 'danger' }, location).icon).toBe('skull')
    expect(resolveLook({ style: 'danger', icon: 'key' }, location).icon).toBe('key')
    expect(resolveLook({ style: 'auto' }, location).icon).toBe('castle')
  })

  it('reads each legacy style as its icon', () => {
    expect(STYLE_ICONS).toEqual({ rumour: 'message-circle', danger: 'skull', treasure: 'coins', quest: 'scroll-text', camp: 'tent' })
  })

  it('merges a renderer\'s configured pin over the built-ins', () => {
    expect(rendererLook('faction')).toEqual({ shape: 'pin', color: 'indigo', icon: 'flag' })
    expect(rendererLook('faction', { shape: 'herald', color: undefined })).toEqual({ shape: 'herald', color: 'indigo', icon: 'flag' })
    expect(resolveLook({ color: 'rust' }, rendererLook('faction', { icon: 'swords' }))).toEqual({ shape: 'pin', color: 'rust', icon: 'swords' })
  })
})

describe('the pin design data', () => {
  it('has the built-in defaults', () => {
    expect(PIN_DEFAULTS).toEqual({
      character: { shape: 'pin', color: 'crimson', icon: 'user' },
      location: { shape: 'pin', color: 'teal', icon: 'castle' },
      faction: { shape: 'pin', color: 'indigo', icon: 'flag' },
      item: { shape: 'pin', color: 'ochre', icon: 'gem' },
      map: { shape: 'pin', color: 'olive', icon: 'map' },
      document: { shape: 'pin', color: 'umber', icon: 'file-text' }
    })
  })

  it('lists five shapes and twelve colours, and the defaults use known ones', () => {
    expect(SHAPES.map((shape) => shape.id)).toEqual([...SHAPE_IDS])
    expect(PIN_COLORS.map((color) => color.id)).toEqual([...COLOR_IDS])
    expect(PIN_COLORS).toHaveLength(12)
    for (const id of RENDERER_IDS) {
      expect(COLOR_IDS).toContain(PIN_DEFAULTS[id].color)
      expect(PIN_ICONS.map((icon) => icon.id)).toContain(PIN_DEFAULTS[id].icon)
    }
  })

  it('lists the catalogue icon ids by category, for checking against Obsidian\'s Lucide', () => {
    expect(PIN_ICON_CATALOG.map((category) => [category.name, category.icons.map((icon) => icon.id)])).toEqual([
      ['Settlements', ['castle', 'house', 'church', 'landmark', 'tower-control', 'tent', 'store', 'beer', 'bed-double', 'anvil', 'library', 'university', 'wheat', 'warehouse']],
      ['Wilds', ['mountain', 'trees', 'tree-pine', 'tree-palm', 'waves', 'droplet', 'flame', 'pickaxe', 'paw-print']],
      ['Travel', ['anchor', 'sailboat', 'signpost', 'footprints', 'compass', 'route']],
      ['Danger & dungeons', ['swords', 'skull', 'triangle-alert', 'ghost', 'bone', 'key', 'lock']],
      ['Story & loot', ['scroll-text', 'star', 'message-circle', 'ear', 'circle-help', 'eye', 'eye-off', 'coins', 'gem', 'sparkles', 'wand-sparkles', 'flask-round']],
      ['People & powers', ['user', 'users', 'crown', 'flag', 'shield', 'handshake', 'venetian-mask', 'dices', 'circle-small', 'map', 'file-text']]
    ])
    expect(new Set(PIN_ICONS.map((icon) => icon.id)).size).toBe(PIN_ICONS.length)
    expect(PIN_ICONS.find((icon) => icon.id === 'circle-small')?.label).toBe('Dot')
    for (const icon of Object.values(STYLE_ICONS)) expect(PIN_ICONS.map((i) => i.id)).toContain(icon)
  })
})
