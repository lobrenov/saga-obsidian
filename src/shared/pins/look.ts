import type { RendererId } from '../renderers/ids'

export const SHAPE_IDS = ['pin', 'circle', 'flag', 'bookmark', 'herald'] as const
export type ShapeId = (typeof SHAPE_IDS)[number]

/** A pin shape on its own grid: outline path, the box the icon is drawn in, and the point that sits on the pin's image point. */
export interface PinShape {
  id: ShapeId
  label: string
  w: number
  h: number
  d: string
  ix: number
  iy: number
  is: number
  ax: number
  ay: number
}

export const SHAPES: readonly PinShape[] = [
  { id: 'pin', label: 'Pin', w: 32, h: 44, d: 'M16 43c-1.5-4-14-15-14-27a14 14 0 0 1 28 0c0 12-12.5 23-14 27z', ix: 8.5, iy: 8.5, is: 15, ax: 16, ay: 43 },
  { id: 'circle', label: 'Circle', w: 32, h: 32, d: 'M16 2a14 14 0 1 0 0 28a14 14 0 1 0 0-28z', ix: 8.5, iy: 8.5, is: 15, ax: 16, ay: 30 },
  { id: 'flag', label: 'Flag', w: 32, h: 31, d: 'M3 3h3v27h-3z M6 4c4-2 8-2 12 0s8 2 12 0v21c-4 2-8 2-12 0s-8-2-12 0z', ix: 11, iy: 7.5, is: 14, ax: 16, ay: 30 },
  { id: 'bookmark', label: 'Bookmark', w: 30, h: 40, d: 'M5 2h20a2 2 0 0 1 2 2v34l-12-7.5L3 38V4a2 2 0 0 1 2-2z', ix: 7.5, iy: 6.5, is: 15, ax: 15, ay: 38 },
  { id: 'herald', label: 'Herald', w: 30, h: 40, d: 'M5 2h20a2 2 0 0 1 2 2v20.5L15 38 3 24.5V4a2 2 0 0 1 2-2z', ix: 7.5, iy: 7, is: 15, ax: 15, ay: 38 }
]

export const COLOR_IDS = ['crimson', 'rust', 'ochre', 'olive', 'moss', 'teal', 'sea', 'indigo', 'violet', 'plum', 'slate', 'umber'] as const
export type ColorId = (typeof COLOR_IDS)[number]

export interface PinColor {
  id: ColorId
  name: string
  light: string
  dark: string
}

export const PIN_COLORS: readonly PinColor[] = [
  { id: 'crimson', name: 'Crimson', light: '#9A3324', dark: '#D9806E' },
  { id: 'rust', name: 'Rust', light: '#A4441F', dark: '#E0895F' },
  { id: 'ochre', name: 'Ochre', light: '#845512', dark: '#D4A35A' },
  { id: 'olive', name: 'Olive', light: '#4F5B3A', dark: '#A3B57E' },
  { id: 'moss', name: 'Moss', light: '#3E6A2F', dark: '#8DC07A' },
  { id: 'teal', name: 'Teal', light: '#2F5F5A', dark: '#6FB3A9' },
  { id: 'sea', name: 'Sea', light: '#2A5F86', dark: '#7DB1D9' },
  { id: 'indigo', name: 'Indigo', light: '#3D4A7C', dark: '#8F9BD6' },
  { id: 'violet', name: 'Violet', light: '#5D3F80', dark: '#B39ADB' },
  { id: 'plum', name: 'Plum', light: '#803356', dark: '#D98AAE' },
  { id: 'slate', name: 'Slate', light: '#46535F', dark: '#9AA8B5' },
  { id: 'umber', name: 'Umber', light: '#5E564B', dark: '#B3A898' }
]

export interface PinIconDef {
  id: string
  label: string
}

/** The icons a pin can show (Lucide ids as bundled with Obsidian), grouped as the pickers list them. */
export const PIN_ICON_CATALOG: readonly { name: string; icons: readonly PinIconDef[] }[] = [
  { name: 'Settlements', icons: [
    { id: 'castle', label: 'Castle' },
    { id: 'house', label: 'Village' },
    { id: 'church', label: 'Temple' },
    { id: 'landmark', label: 'Hall' },
    { id: 'tower-control', label: 'Tower' },
    { id: 'tent', label: 'Camp' },
    { id: 'store', label: 'Market' },
    { id: 'beer', label: 'Tavern' },
    { id: 'bed-double', label: 'Inn' },
    { id: 'anvil', label: 'Smithy' },
    { id: 'library', label: 'Library' },
    { id: 'university', label: 'Academy' },
    { id: 'wheat', label: 'Farm' },
    { id: 'warehouse', label: 'Warehouse' }
  ] },
  { name: 'Wilds', icons: [
    { id: 'mountain', label: 'Mountain' },
    { id: 'trees', label: 'Forest' },
    { id: 'tree-pine', label: 'Pines' },
    { id: 'tree-palm', label: 'Island' },
    { id: 'waves', label: 'Water' },
    { id: 'droplet', label: 'Spring' },
    { id: 'flame', label: 'Fire' },
    { id: 'pickaxe', label: 'Mine' },
    { id: 'paw-print', label: 'Beasts' }
  ] },
  { name: 'Travel', icons: [
    { id: 'anchor', label: 'Port' },
    { id: 'sailboat', label: 'Ship' },
    { id: 'signpost', label: 'Crossroads' },
    { id: 'footprints', label: 'Tracks' },
    { id: 'compass', label: 'Expedition' },
    { id: 'route', label: 'Route' }
  ] },
  { name: 'Danger & dungeons', icons: [
    { id: 'swords', label: 'Battle' },
    { id: 'skull', label: 'Danger' },
    { id: 'triangle-alert', label: 'Hazard' },
    { id: 'ghost', label: 'Haunting' },
    { id: 'bone', label: 'Remains' },
    { id: 'key', label: 'Key' },
    { id: 'lock', label: 'Locked' }
  ] },
  { name: 'Story & loot', icons: [
    { id: 'scroll-text', label: 'Quest' },
    { id: 'star', label: 'Objective' },
    { id: 'message-circle', label: 'Rumour' },
    { id: 'ear', label: 'Overheard' },
    { id: 'circle-help', label: 'Unknown' },
    { id: 'eye', label: 'Lookout' },
    { id: 'eye-off', label: 'Hidden' },
    { id: 'coins', label: 'Coin' },
    { id: 'gem', label: 'Gem' },
    { id: 'sparkles', label: 'Magic' },
    { id: 'wand-sparkles', label: 'Spell' },
    { id: 'flask-round', label: 'Alchemy' }
  ] },
  { name: 'People & powers', icons: [
    { id: 'user', label: 'Person' },
    { id: 'users', label: 'Party' },
    { id: 'crown', label: 'Ruler' },
    { id: 'flag', label: 'Faction' },
    { id: 'shield', label: 'Stronghold' },
    { id: 'handshake', label: 'Ally' },
    { id: 'venetian-mask', label: 'Intrigue' },
    { id: 'dices', label: 'Encounter' },
    { id: 'circle-small', label: 'Dot' },
    { id: 'map', label: 'Map' },
    { id: 'calendar-days', label: 'Calendar' },
    { id: 'file-text', label: 'Document' }
  ] },
]

export const PIN_ICONS: readonly PinIconDef[] = PIN_ICON_CATALOG.flatMap((category) => category.icons)

/** Drawn when Obsidian does not know an icon id. */
export const FALLBACK_ICON = 'circle-small'

/** What a pin looks like at each level of the resolution: shape, colour and icon. */
export interface PinLook {
  shape: ShapeId
  color: ColorId
  icon: string
}

/** A renderer's built-in pin look; the shape is always `pin`. */
export const PIN_DEFAULTS: Record<RendererId, PinLook> = {
  character: { shape: 'pin', color: 'crimson', icon: 'user' },
  location: { shape: 'pin', color: 'teal', icon: 'castle' },
  faction: { shape: 'pin', color: 'indigo', icon: 'flag' },
  item: { shape: 'pin', color: 'ochre', icon: 'gem' },
  map: { shape: 'pin', color: 'olive', icon: 'map' },
  calendar: { shape: 'pin', color: 'slate', icon: 'calendar-days' },
  document: { shape: 'pin', color: 'umber', icon: 'file-text' }
}

/** The icon each legacy pin style reads as (`auto` has none). */
export const STYLE_ICONS = {
  rumour: 'message-circle',
  danger: 'skull',
  treasure: 'coins',
  quest: 'scroll-text',
  camp: 'tent'
} as const

/** The keys of a pin's look as set in config or on a pin. */
export type PinLookOverrides = { [K in keyof PinLook]?: PinLook[K] | undefined }

/** The look of a renderer's pins: its config `pin` over the built-ins. */
export const rendererLook = (renderer: RendererId, configured?: PinLookOverrides): PinLook => ({ ...PIN_DEFAULTS[renderer], ...definedOnly(configured) })

/** A pin's look: its own keys, else the icon its legacy `style` reads as, else the renderer's look. */
export function resolveLook(entry: PinLookOverrides & { style?: string | undefined }, defaults: PinLook): PinLook {
  const styleIcon = entry.style !== undefined && Object.hasOwn(STYLE_ICONS, entry.style) ? STYLE_ICONS[entry.style as keyof typeof STYLE_ICONS] : undefined
  return { ...defaults, ...definedOnly({ shape: entry.shape, color: entry.color, icon: entry.icon ?? styleIcon }) }
}

function definedOnly(look: PinLookOverrides | undefined): Partial<PinLook> {
  return Object.fromEntries(Object.entries(look ?? {}).filter(([, value]) => value !== undefined))
}
