import { z } from 'zod'
import type { PinLookOverrides } from '../pins/look'
import { pinColorSchema, pinIconSchema, pinShapeSchema } from './pins'
import { rendererDefs } from '../renderers/definitions'
import { notePathSchema } from '../ids'
import type { FieldDef, Fields } from '../renderers/fields'
import { RENDERER_IDS, type RendererId } from '../renderers/ids'
import type { Issue } from '../result'
import { zodIssues } from './issues'

export const rendererConfigSchema = z.object({
  types: z.array(z.string()),
  keys: z.record(z.string(), z.string()),
  templates: z.array(notePathSchema),
  /** The renderer's pin look; keys left out take the built-in defaults. */
  pin: z.object({ shape: pinShapeSchema.optional(), color: pinColorSchema.optional(), icon: pinIconSchema.optional() }).optional(),
  /** Optional fields the header leaves out, in field order. */
  hidden: z.array(z.string()).optional()
})
export type RendererConfig = z.output<typeof rendererConfigSchema>

export const configSchema = z.object({
  typeKey: z.string(),
  renderers: z.partialRecord(z.enum(RENDERER_IDS), rendererConfigSchema)
})
export type Config = z.output<typeof configSchema>

const fileSchema = z.object({ typeKey: z.string().optional(), renderers: z.record(z.string(), z.unknown()).optional() })
const entrySchema = z.object({
  types: z.array(z.string()).default([]),
  keys: z.record(z.string(), z.string()).default({}),
  templates: z.array(notePathSchema).default([]),
  pin: z.unknown().optional(),
  hidden: z.array(z.string()).default([])
})

const PIN_KEYS = [
  ['shape', pinShapeSchema],
  ['color', pinColorSchema],
  ['icon', pinIconSchema]
] as const

/** The known keys of a renderer's `pin` value; unknown values are dropped and reported. */
function readPin(raw: unknown, path: string, issues: Issue[]): PinLookOverrides | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push({ path, message: 'pin must be a mapping' })
    return undefined
  }
  const pin: Record<string, unknown> = {}
  for (const [key, schema] of PIN_KEYS) {
    const given = (raw as Record<string, unknown>)[key]
    if (given === undefined) continue
    const known = schema.safeParse(given)
    if (known.success) pin[key] = known.data
    else issues.push({ path: `${path}.${key}`, message: `Unknown pin ${key === 'color' ? 'colour' : key} ${JSON.stringify(given)}` })
  }
  return Object.keys(pin).length > 0 ? pin : undefined
}

const isRendererId = (id: string): id is RendererId => (RENDERER_IDS as readonly string[]).includes(id)

/** Reads `.saga/renderers.yaml` content (already YAML-parsed). Unknown renderers, fields and malformed entries are dropped and reported; `invalid` lists the renderers whose entry could not be read. */
export function parseConfig(raw: unknown): { config: Config; issues: Issue[]; invalid: RendererId[] } {
  const config: Config = { typeKey: 'type', renderers: {} }
  const issues: Issue[] = []
  const invalid: RendererId[] = []
  if (raw === undefined || raw === null) return { config, issues, invalid }
  const file = fileSchema.safeParse(raw)
  if (!file.success) return { config, issues: zodIssues(file.error), invalid }
  config.typeKey = file.data.typeKey ?? 'type'
  if (config.typeKey.trim() === '') issues.push({ path: 'typeKey', message: 'The type key must not be empty' })
  const typeOwner = new Map<string, RendererId>()

  for (const [id, entryRaw] of Object.entries(file.data.renderers ?? {})) {
    const path = `renderers.${id}`
    if (!isRendererId(id)) {
      issues.push({ path, message: `Unknown renderer "${id}"` })
      continue
    }
    const entry = entrySchema.safeParse(entryRaw)
    if (!entry.success) {
      issues.push(...zodIssues(entry.error, path))
      invalid.push(id)
      continue
    }
    const known = Object.fromEntries(Object.entries<FieldDef>(rendererDefs[id].fields).filter(([, def]) => def.kind !== 'date'))
    const keys: Record<string, string> = {}
    for (const [field, key] of Object.entries(entry.data.keys)) {
      if (Object.hasOwn(known, field)) keys[field] = key
      else issues.push({ path: `${path}.keys.${field}`, message: `Unknown field "${field}" for renderer "${id}"` })
    }
    const byKey = new Map<string, string>()
    for (const [field, def] of Object.entries<FieldDef>(rendererDefs[id].fields)) {
      if (def.kind === 'date') continue
      const key = keys[field] ?? def.key
      const other = byKey.get(key)
      if (key.trim() === '') issues.push({ path: `${path}.keys.${field}`, message: `The key for "${field}" must not be empty` })
      else if (key === config.typeKey || key === 'map-pins') {
        issues.push({ path: `${path}.keys.${field}`, message: `The key for "${field}" must not be "${key}": it is reserved` })
      } else if (other) issues.push({ path: `${path}.keys.${field}`, message: `Fields "${other}" and "${field}" both use key "${key}"` })
      else byKey.set(key, field)
    }
    for (const type of entry.data.types) {
      if (type.trim() === '') {
        issues.push({ path: `${path}.types`, message: 'A type must not be empty' })
        continue
      }
      const lower = type.toLowerCase()
      const owner = typeOwner.get(lower)
      if (owner && owner !== id) issues.push({ path: `${path}.types`, message: `Type "${type}" is already mapped to renderer "${owner}"` })
      else typeOwner.set(lower, id)
    }
    const fields: Fields = rendererDefs[id].fields
    for (const field of entry.data.hidden) {
      if (!Object.hasOwn(fields, field)) issues.push({ path: `${path}.hidden`, message: `Unknown field "${field}" for renderer "${id}"` })
      else if (!fields[field]?.optional) issues.push({ path: `${path}.hidden`, message: `Field "${field}" of renderer "${id}" cannot be hidden` })
    }
    const hidden = Object.keys(fields).filter((field) => fields[field]?.optional && entry.data.hidden.includes(field))
    const pin = readPin(entry.data.pin, `${path}.pin`, issues)
    config.renderers[id] = { types: entry.data.types, keys, templates: entry.data.templates, ...(pin && { pin }), ...(hidden.length > 0 && { hidden }) }
  }
  return { config, issues, invalid }
}
