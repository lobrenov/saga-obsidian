import { expectTypeOf, test } from 'vitest'
import { defineRenderer } from '../../src/shared/renderers/define'
import type { FieldEditors, KeyMap, RendererValues } from '../../src/shared/renderers/define'
import type { character, document, map } from '../../src/shared/renderers/definitions'
import type { WikiLink } from '../../src/shared/wikilink'

const sample = defineRenderer({
  id: 'item',
  label: 'Sample',
  icon: 'x',
  color: 'item',
  pinStyle: 'auto',
  fields: {
    title: { kind: 'text', key: 'title', required: true, label: 'Title' },
    tags: { kind: 'list', key: 'tags', required: false, label: 'Tags' },
    home: { kind: 'link', key: 'home', required: true, label: 'Home' },
    art: { kind: 'image', key: 'art', required: false, label: 'Art' },
    rarity: { kind: 'choice', key: 'rarity', required: true, label: 'Rarity', options: ['common', 'rare'] }
  }
})

void sample

test('RendererValues splits required and optional fields', () => {
  expectTypeOf<RendererValues<typeof sample>>().toEqualTypeOf<{
    title: string
    home: WikiLink
    rarity: 'common' | 'rare'
    tags?: string[]
    art?: WikiLink
  }>()
})

test('shipped renderers', () => {
  expectTypeOf<RendererValues<typeof map>>().toEqualTypeOf<{ image: WikiLink }>()
  expectTypeOf<RendererValues<typeof character>>().toEqualTypeOf<{
    role: string
    location: WikiLink
    portrait?: WikiLink
    title?: string
    affiliation?: WikiLink
    status?: 'alive' | 'dead' | 'missing'
  }>()
  expectTypeOf<keyof RendererValues<typeof document>>().toBeNever()
})

test('KeyMap maps field names to note keys', () => {
  expectTypeOf<KeyMap<typeof sample>>().toEqualTypeOf<{ title: string; tags: string; home: string; art: string; rarity: string }>()
})

test('FieldEditors requires every field kind', () => {
  // @ts-expect-error the `choice` editor is missing
  const editors: FieldEditors<string> = { text: () => '', list: () => '', link: () => '', image: () => '' }
  void editors
})

test('defineRenderer rejects an unknown renderer id', () => {
  // @ts-expect-error not a renderer id
  defineRenderer({ id: 'monster', label: '', icon: '', color: '', pinStyle: 'auto', fields: {} })
})
