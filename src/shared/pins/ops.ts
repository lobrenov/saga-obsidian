import { Document } from 'yaml'
import { parseFrontmatter, setFrontmatterKey } from '../frontmatter'
import { err, ok, type Result } from '../result'
import type { MapPin, PinOp } from '../schemas/pins'
import { STYLE_ICONS } from './look'

/** Pin coordinates are written with one decimal. */
export const roundCoord = (value: number): number => Math.round(value * 10) / 10

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const invalid = (message: string): Result<never> => err({ kind: 'validation', message, issues: [{ path: 'map-pins', message }] })

/** The `map-pins` entry written for a new pin: its position and any look keys it carries (no defaults, no legacy style). */
export function pinEntry(pin: MapPin): Record<string, unknown> {
  const { shape, color, icon } = pin
  return { map: pin.map, x: roundCoord(pin.x), y: roundCoord(pin.y), ...(shape && { shape }), ...(color && { color }), ...(icon && { icon }) }
}

/** The entry with `style` replaced in place by the icon it reads as; an existing `icon` is kept, `auto` and unknown styles just drop. */
function withoutStyle(entry: Record<string, unknown>): Record<string, unknown> {
  if (!('style' in entry)) return entry
  const style = entry.style
  const icon = typeof style === 'string' && Object.hasOwn(STYLE_ICONS, style) && entry.icon === undefined ? STYLE_ICONS[style as keyof typeof STYLE_ICONS] : undefined
  return Object.fromEntries(Object.entries(entry).flatMap(([key, value]) => (key !== 'style' ? [[key, value]] : icon ? [['icon', icon]] : [])))
}

/** The YAML a new pin adds to its note, for the preview. */
export const pinYaml = (pin: MapPin): string => new Document({ 'map-pins': [pinEntry(pin)] }).toString({ lineWidth: 0, singleQuote: false }).trimEnd()

function entryAt(list: readonly unknown[], index: number): Result<Record<string, unknown>> {
  const entry = list[index]
  if (entry === undefined) return invalid(`The note has no pin ${index + 1}`)
  return isRecord(entry) ? ok(entry) : invalid(`Pin ${index + 1} is not a mapping`)
}

/**
 * Applies `op` to a raw `map-pins` value (as parsed from the note). Entries the op does not name are returned as they are,
 * and a changed entry keeps its other keys and their order. Returns the new list.
 */
export function applyPinOp(list: unknown, op: PinOp): Result<unknown[]> {
  if (list !== undefined && list !== null && !Array.isArray(list)) return invalid('map-pins must be a list')
  const current: unknown[] = list ?? []
  if (op.kind === 'add') return ok([...current, pinEntry(op.pin)])
  if (op.kind === 'remove') return op.index < current.length ? ok(current.filter((_, i) => i !== op.index)) : invalid(`The note has no pin ${op.index + 1}`)
  const entry = entryAt(current, op.index)
  if (!entry.ok) return entry
  const next: Record<string, unknown> = { ...withoutStyle(entry.value) }
  if (op.kind === 'move') {
    next.x = roundCoord(op.x)
    next.y = roundCoord(op.y)
  } else {
    for (const key of ['shape', 'color', 'icon'] as const) {
      const value = op[key]
      if (value === null) delete next[key]
      else if (value !== undefined) next[key] = value
    }
  }
  return ok(current.map((item, i) => (i === op.index ? next : item)))
}

/** The value to store under `map-pins` after an op: undefined (key removed) once the list is empty. */
export const storedPins = (list: readonly unknown[]): unknown[] | undefined => (list.length === 0 ? undefined : [...list])

/** The file text after `op`: only the `map-pins` value changes (BOM, line endings and every other key are kept). */
export function applyPinOpToText(fileText: string, op: PinOp): Result<string> {
  const parsed = parseFrontmatter(fileText)
  const first = parsed.errors[0]
  if (first) return err({ kind: 'parse', message: `Invalid frontmatter: ${first.message}` })
  const next = applyPinOp(parsed.data['map-pins'], op)
  if (!next.ok) return next
  return setFrontmatterKey(fileText, 'map-pins', storedPins(next.value))
}
