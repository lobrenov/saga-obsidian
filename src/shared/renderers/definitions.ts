import { defineRenderer } from './define'

// Field lists are minimal; the mocks in docs/design drive them.
export const character = defineRenderer({
  id: 'character',
  label: 'Character',
  icon: 'user',
  color: 'character',
  pinStyle: 'auto',
  fields: {
    portrait: { kind: 'image', key: 'portrait', required: false, label: 'Portrait' },
    role: { kind: 'text', key: 'role', required: true, label: 'Role' },
    title: { kind: 'text', key: 'title', required: false, label: 'Title' },
    affiliation: { kind: 'link', key: 'affiliation', required: false, label: 'Affiliation' },
    location: { kind: 'link', key: 'location', required: true, label: 'Location' },
    status: { kind: 'choice', key: 'status', required: false, label: 'Status', options: ['alive', 'dead', 'missing'] }
  }
})

export const location = defineRenderer({
  id: 'location',
  label: 'Location',
  icon: 'map-pin',
  color: 'location',
  pinStyle: 'auto',
  fields: {
    image: { kind: 'image', key: 'image', required: false, label: 'Image' },
    kind: { kind: 'text', key: 'kind', required: false, label: 'Kind' },
    region: { kind: 'link', key: 'region', required: false, label: 'Region' }
  }
})

export const faction = defineRenderer({
  id: 'faction',
  label: 'Faction',
  icon: 'flag',
  color: 'faction',
  pinStyle: 'auto',
  fields: {
    emblem: { kind: 'image', key: 'emblem', required: false, label: 'Emblem' },
    kind: { kind: 'text', key: 'kind', required: false, label: 'Kind' },
    leader: { kind: 'link', key: 'leader', required: false, label: 'Leader' },
    base: { kind: 'link', key: 'base', required: false, label: 'Base' },
    allies: { kind: 'links', key: 'allies', required: false, label: 'Allies' },
    rivals: { kind: 'links', key: 'rivals', required: false, label: 'Rivals' }
  }
})

export const item = defineRenderer({
  id: 'item',
  label: 'Item',
  icon: 'gem',
  color: 'item',
  pinStyle: 'treasure',
  fields: {
    image: { kind: 'image', key: 'image', required: false, label: 'Image' },
    kind: { kind: 'text', key: 'kind', required: false, label: 'Kind' },
    rarity: { kind: 'text', key: 'rarity', required: false, label: 'Rarity' },
    holder: { kind: 'link', key: 'holder', required: false, label: 'Held by' },
    owner: { kind: 'link', key: 'owner', required: false, label: 'Owner' },
    location: { kind: 'link', key: 'location', required: false, label: 'Location' },
    origin: { kind: 'link', key: 'origin', required: false, label: 'Origin' }
  }
})

export const map = defineRenderer({
  id: 'map',
  label: 'Map',
  icon: 'map',
  color: 'map',
  pinStyle: 'auto',
  fields: {
    image: { kind: 'image', key: 'image', required: true, label: 'Image' }
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
