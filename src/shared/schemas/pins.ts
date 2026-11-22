import { z } from 'zod'
import type { Issue, Validated } from '../result'
import { COLOR_IDS, PIN_ICONS, SHAPE_IDS } from '../pins/look'
import { parseWikiLink } from '../wikilink'
import { zodIssues } from './issues'

export const PIN_STYLES = ['auto', 'rumour', 'danger', 'treasure', 'quest', 'camp'] as const
export type PinStyle = (typeof PIN_STYLES)[number]
export const pinStyleSchema = z.enum(PIN_STYLES)

export const pinShapeSchema = z.enum(SHAPE_IDS)
export const pinColorSchema = z.enum(COLOR_IDS)
export const pinIconSchema = z.string().refine((id) => PIN_ICONS.some((icon) => icon.id === id), { message: 'Not a pin icon' })

const mapLink = z.string().refine((s) => parseWikiLink(s) !== null, { message: 'Not a wikilink' })

/** A pin as stored in a note's `map-pins` frontmatter. */
export const mapPinSchema = z.object({
  map: mapLink,
  x: z.number(),
  y: z.number(),
  shape: pinShapeSchema.optional(),
  color: pinColorSchema.optional(),
  icon: pinIconSchema.optional(),
  /** Legacy: read as an icon (`STYLE_ICONS`) and replaced by `icon` on the entry's next write. */
  style: pinStyleSchema.optional()
})
export type MapPin = z.output<typeof mapPinSchema>

// Same shape with the look keys and style left unchecked so an unknown value can fall back.
const lenientPin = mapPinSchema.extend({ shape: z.unknown().optional(), color: z.unknown().optional(), icon: z.unknown().optional(), style: z.unknown().optional() })

const LOOK_KEYS = [
  ['shape', pinShapeSchema, 'shape'],
  ['color', pinColorSchema, 'colour'],
  ['icon', pinIconSchema, 'icon']
] as const

/** Validates one pin; an unknown shape, colour or icon is dropped (the renderer's applies) and an unknown style becomes `auto`, each with an issue. */
export function parseMapPin(input: unknown): Validated<MapPin> {
  const parsed = lenientPin.safeParse(input)
  if (!parsed.success) return { value: undefined, issues: zodIssues(parsed.error) }
  const { shape, color, icon, style, ...rest } = parsed.data
  const value: MapPin = rest
  const issues: Issue[] = []
  for (const [key, schema, noun] of LOOK_KEYS) {
    const given = { shape, color, icon }[key]
    if (given === undefined) continue
    const known = schema.safeParse(given)
    if (known.success) Object.assign(value, { [key]: known.data })
    else issues.push({ path: key, message: `Unknown pin ${noun} ${JSON.stringify(given)}; using the default` })
  }
  if (style !== undefined) {
    const known = pinStyleSchema.safeParse(style)
    if (known.success) value.style = known.data
    else {
      value.style = 'auto'
      issues.push({ path: 'style', message: `Unknown pin style ${JSON.stringify(style)}; using auto` })
    }
  }
  return { value, issues }
}

/** One `map-pins` entry: its position and original value are kept so a single entry can be edited and the rest written back unchanged. */
export interface PinEntry {
  index: number
  raw: unknown
  /** Undefined when the entry is invalid. */
  pin: MapPin | undefined
  issues: Issue[]
}

/** Validates a `map-pins` list; invalid entries are kept as raw with their issues. */
export function parseMapPins(input: unknown): { entries: PinEntry[]; pins: MapPin[]; issues: Issue[] } {
  if (input === undefined || input === null) return { entries: [], pins: [], issues: [] }
  if (!Array.isArray(input)) return { entries: [], pins: [], issues: [{ path: '', message: 'map-pins must be a list' }] }
  const entries = input.map((raw: unknown, index): PinEntry => {
    const result = parseMapPin(raw)
    return {
      index,
      raw,
      pin: result.value,
      issues: result.issues.map((issue) => ({ ...issue, path: [String(index), issue.path].filter(Boolean).join('.') }))
    }
  })
  return {
    entries,
    pins: entries.flatMap((entry) => (entry.pin ? [entry.pin] : [])),
    issues: entries.flatMap((entry) => entry.issues)
  }
}

const entryIndex = z.number().int().nonnegative()

/** One change to a note's `map-pins` list; `index` is the position in the list as written in the note. */
export const pinOpSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('add'), pin: mapPinSchema }),
  z.object({ kind: z.literal('move'), index: entryIndex, x: z.number(), y: z.number() }),
  z.object({ kind: z.literal('remove'), index: entryIndex }),
  /** Sets each given key of the entry's look; `null` removes it (back to the renderer's); an absent key is left. */
  z.object({
    kind: z.literal('look'),
    index: entryIndex,
    shape: pinShapeSchema.nullable().optional(),
    color: pinColorSchema.nullable().optional(),
    icon: pinIconSchema.nullable().optional()
  })
])
export type PinOp = z.output<typeof pinOpSchema>
