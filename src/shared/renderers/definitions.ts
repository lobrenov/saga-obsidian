import { defineRenderer } from './define'

// Field lists are minimal; the mocks in docs/design drive them.
export const character = defineRenderer({
  id: 'character',
  label: 'Character',
  icon: 'user',
  color: 'character',
  fields: {
    portrait: { kind: 'image', key: 'portrait', label: 'Portrait' },
    title: { kind: 'text', key: 'title', label: 'Title', optional: true },
    affiliation: { kind: 'link', key: 'affiliation', label: 'Affiliation', optional: true },
    location: { kind: 'link', key: 'location', label: 'Location', optional: true },
    status: { kind: 'choice', key: 'status', label: 'Status', optional: true, options: ['alive', 'dead', 'missing'] }
  }
})

export const location = defineRenderer({
  id: 'location',
  label: 'Location',
  icon: 'map-pin',
  color: 'location',
  banner: 'image',
  fields: {
    image: { kind: 'image', key: 'image', label: 'Image' },
    kind: { kind: 'text', key: 'kind', label: 'Kind', optional: true },
    region: { kind: 'link', key: 'region', label: 'Region', optional: true }
  }
})

export const faction = defineRenderer({
  id: 'faction',
  label: 'Faction',
  icon: 'flag',
  color: 'faction',
  fields: {
    emblem: { kind: 'image', key: 'emblem', label: 'Emblem' },
    kind: { kind: 'text', key: 'kind', label: 'Kind', optional: true },
    leader: { kind: 'link', key: 'leader', label: 'Leader', optional: true },
    base: { kind: 'link', key: 'base', label: 'Base', optional: true },
    allies: { kind: 'links', key: 'allies', label: 'Allies', optional: true },
    rivals: { kind: 'links', key: 'rivals', label: 'Rivals', optional: true }
  }
})

export const item = defineRenderer({
  id: 'item',
  label: 'Item',
  icon: 'gem',
  color: 'item',
  fields: {
    image: { kind: 'image', key: 'image', label: 'Image' },
    kind: { kind: 'text', key: 'kind', label: 'Kind', optional: true },
    rarity: { kind: 'text', key: 'rarity', label: 'Rarity', optional: true },
    owner: { kind: 'link', key: 'owner', label: 'Owner', optional: true },
    location: { kind: 'link', key: 'location', label: 'Location', optional: true }
  }
})

export const map = defineRenderer({
  id: 'map',
  label: 'Map',
  icon: 'map',
  color: 'map',
  banner: 'image',
  fields: {
    image: { kind: 'image', key: 'image', label: 'Image' }
  }
})

/** The fallback renderer: no fields, any note is compatible. */
export const document = defineRenderer({
  id: 'document',
  label: 'Document',
  icon: 'file-text',
  color: 'document',
  fields: {}
})

export const rendererDefs = { character, location, faction, item, map, document } as const
