import { describe, expect, it } from 'vitest'
import { bannerOf } from '../../../src/shared/renderers/banner'
import { rendererDefs } from '../../../src/shared/renderers/definitions'
import { allTypes } from '../../../src/shared/renderers/resolve'
import type { Config } from '../../../src/shared/schemas/config'

const { character, location, item, map, document } = rendererDefs

describe('bannerOf', () => {
  it('reads image for renderers that draw it as their banner, following renames', () => {
    expect(bannerOf(location, {}, { image: '[[coast.png]]' })).toMatchObject({ key: 'image', link: { target: 'coast.png' } })
    expect(bannerOf(location, { image: 'picture' }, { picture: '[[coast.png]]', image: '[[other.png]]' })).toMatchObject({
      key: 'picture',
      link: { target: 'coast.png' }
    })
  })

  it('reads banner for every other renderer and for documents', () => {
    expect(bannerOf(character, {}, { banner: '[[keep.jpg]]' })).toMatchObject({ key: 'banner', link: { target: 'keep.jpg' } })
    expect(bannerOf(document, {}, { banner: '[[vault.jpg]]' })).toMatchObject({ key: 'banner', link: { target: 'vault.jpg' } })
    expect(bannerOf(character, {}, { image: '[[keep.jpg]]' }).link).toBeNull()
    expect(bannerOf(item, {}, { banner: '[[forge.jpg]]', image: '[[sword.png]]' })).toMatchObject({ key: 'banner', link: { target: 'forge.jpg' } })
  })

  it('has no link for a value that is not a wikilink', () => {
    expect(bannerOf(document, {}, { banner: 'https://example.com/a.png' }).link).toBeNull()
    expect(bannerOf(document, {}, {}).link).toBeNull()
  })

  it('reads banner-y as a whole percentage, 50 when missing or invalid', () => {
    expect(bannerOf(document, {}, {}).y).toBe(50)
    expect(bannerOf(document, {}, { 'banner-y': 30 }).y).toBe(30)
    expect(bannerOf(document, {}, { 'banner-y': 33.6 }).y).toBe(34)
    expect(bannerOf(document, {}, { 'banner-y': 140 }).y).toBe(100)
    expect(bannerOf(document, {}, { 'banner-y': -5 }).y).toBe(0)
    expect(bannerOf(document, {}, { 'banner-y': 'top' }).y).toBe(50)
  })

  it('offers Remove except on maps', () => {
    expect(bannerOf(map, {}, {}).removable).toBe(false)
    expect(bannerOf(location, {}, {}).removable).toBe(true)
    expect(bannerOf(document, {}, {}).removable).toBe(true)
  })
})

describe('allTypes', () => {
  it("lists every renderer's types but document's, ids for unconfigured renderers", () => {
    const config: Config = { typeKey: 'type', renderers: { character: { types: ['NPC', 'PC'], keys: {}, templates: [] } } }
    expect(allTypes(config)).toEqual(['NPC', 'PC', 'location', 'faction', 'item', 'map'])
  })
})
