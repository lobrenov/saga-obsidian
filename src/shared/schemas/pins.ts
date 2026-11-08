import { z } from 'zod'
import type { Issue, Validated } from '../result'
import { parseWikiLink } from '../wikilink'
import { zodIssues } from './issues'

export const PIN_STYLES = ['auto', 'rumour', 'danger', 'treasure', 'quest', 'camp'] as const
export type PinStyle = (typeof PIN_STYLES)[number]
export const pinStyleSchema = z.enum(PIN_STYLES)

const mapLink = z.string().refine((s) => parseWikiLink(s) !== null, { message: 'Not a wikilink' })

/** A pin as stored in a note's `map-pins` frontmatter. */
export const mapPinSchema = z.object({
  map: mapLink,
  x: z.number(),
  y: z.number(),
  style: pinStyleSchema.optional()
})
export type MapPin = z.output<typeof mapPinSchema>

// Same shape with the style left unchecked so an unknown style can fall back.
const lenientPin = mapPinSchema.extend({ style: z.unknown().optional() })

/** Validates one pin; an unknown style becomes `auto` with an issue. */
export function parseMapPin(input: unknown): Validated<MapPin> {
  const parsed = lenientPin.safeParse(input)
  if (!parsed.success) return { value: undefined, issues: zodIssues(parsed.error) }
  const { style, ...rest } = parsed.data
  if (style === undefined) return { value: rest, issues: [] }
  const known = pinStyleSchema.safeParse(style)
  if (known.success) return { value: { ...rest, style: known.data }, issues: [] }
  return {
    value: { ...rest, style: 'auto' },
    issues: [{ path: 'style', message: `Unknown pin style ${JSON.stringify(style)}; using auto` }]
  }
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
  /** `null` removes the override (back to `auto`). */
  z.object({ kind: z.literal('style'), index: entryIndex, style: pinStyleSchema.nullable() })
])
export type PinOp = z.output<typeof pinOpSchema>
