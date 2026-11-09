import { defineRenderer } from './define'

// Field lists are minimal; the mocks in docs/design drive them.
export const character = defineRenderer({
  id: 'character',
  label: 'Character',
  icon: 'user',
  color: 'character',
  pinStyle: 'auto',
  fields: {
    portrait: { kind: 'image', key: 'portrait', label: 'Portrait' },
    title: { kind: 'text', key: 'title', label: 'Title' },
    affiliation: { kind: 'link', key: 'affiliation', label: 'Affiliation' },
    location: { kind: 'link', key: 'location', label: 'Location' },
    status: { kind: 'choice', key: 'status', label: 'Status', options: ['alive', 'dead', 'missing'] }
  }
})

export const location = defineRenderer({
  id: 'location',
  label: 'Location',
  icon: 'map-pin',
  color: 'location',
  pinStyle: 'auto',
  fields: {
    image: { kind: 'image', key: 'image', label: 'Image' },
    kind: { kind: 'text', key: 'kind', label: 'Kind' },
    region: { kind: 'link', key: 'region', label: 'Region' }
  }
})

export const faction = defineRenderer({
  id: 'faction',
  label: 'Faction',
  icon: 'flag',
  color: 'faction',
  pinStyle: 'auto',
  fields: {
    emblem: { kind: 'image', key: 'emblem', label: 'Emblem' },
    kind: { kind: 'text', key: 'kind', label: 'Kind' },
    leader: { kind: 'link', key: 'leader', label: 'Leader' },
    base: { kind: 'link', key: 'base', label: 'Base' },
    allies: { kind: 'links', key: 'allies', label: 'Allies' },
    rivals: { kind: 'links', key: 'rivals', label: 'Rivals' }
  }
})

export const item = defineRenderer({
  id: 'item',
  label: 'Item',
  icon: 'gem',
  color: 'item',
  pinStyle: 'treasure',
  fields: {
    image: { kind: 'image', key: 'image', label: 'Image' },
    kind: { kind: 'text', key: 'kind', label: 'Kind' },
    rarity: { kind: 'text', key: 'rarity', label: 'Rarity' },
    holder: { kind: 'link', key: 'holder', label: 'Held by' },
    owner: { kind: 'link', key: 'owner', label: 'Owner' },
    location: { kind: 'link', key: 'location', label: 'Location' },
    origin: { kind: 'link', key: 'origin', label: 'Origin' }
  }
})

export const map = defineRenderer({
  id: 'map',
  label: 'Map',
  icon: 'map',
  color: 'map',
  pinStyle: 'auto',
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
  pinStyle: 'auto',
  fields: {}
})

export const rendererDefs = { character, location, faction, item, map, document } as const
