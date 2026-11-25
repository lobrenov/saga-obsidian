import type { Config } from '../schemas/config'
import type { RendererDef } from './define'
import { rendererDefs } from './definitions'
import { RENDERER_IDS, type RendererId } from './ids'

export interface RendererResolution {
  /** The note's `typeKey` value, trimmed; null when absent or blank. */
  type: string | null
  renderer: RendererId
}

/** The trimmed string at the config's type key, or null. */
export const typeOf = (config: Config, frontmatter: Readonly<Record<string, unknown>>): string | null => {
  const raw = frontmatter[config.typeKey]
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

/** The types that map to a renderer while the config lists none: the definition's, else its label. */
export const defaultTypes = (id: RendererId): readonly string[] => {
  const def = rendererDefs[id] as RendererDef
  return def.types ?? [def.label]
}

/**
 * Builds the type -> renderer lookup once per config (case-insensitive types, `document` fallback).
 * A renderer without configured `types` matches its default types (its label unless the definition lists others); configured types replace them.
 */
export function createRendererResolver(config: Config): (frontmatter: Readonly<Record<string, unknown>>) => RendererResolution {
  const byType = new Map<string, RendererId>()
  const add = (type: string, id: RendererId): void => {
    const lower = type.toLowerCase()
    if (!byType.has(lower)) byType.set(lower, id)
  }
  for (const id of RENDERER_IDS) config.renderers[id]?.types.forEach((type) => add(type, id))
  for (const id of RENDERER_IDS) if (!config.renderers[id]?.types.length) defaultTypes(id).forEach((type) => add(type, id))
  return (frontmatter) => {
    const type = typeOf(config, frontmatter)
    return { type, renderer: (type && byType.get(type.toLowerCase())) || 'document' }
  }
}

/** The types that map to a renderer: its configured list, else its default types. */
export const typesOf = (config: Config, id: RendererId): readonly string[] => {
  const types = config.renderers[id]?.types
  return types?.length ? types : defaultTypes(id)
}

/** Every type that maps to a renderer other than `document`, in renderer order. */
export const allTypes = (config: Config): readonly string[] => RENDERER_IDS.filter((id) => id !== 'document').flatMap((id) => typesOf(config, id))
