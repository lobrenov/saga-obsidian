import { wikiLinkSchema, type WikiLink } from '../wikilink'
import type { RendererDef } from './define'

export const BANNER_KEY = 'banner'
export const BANNER_Y_KEY = 'banner-y'

export interface Banner {
  /** The note key holding the banner image. */
  key: string
  link: WikiLink | null
  /** The image's vertical position, 0–100 percent. */
  y: number
  /** Remove is offered (not on maps, whose image is the map). */
  removable: boolean
}

/** A position limited to 0–100 and rounded to a whole percent. */
export const clamp = (y: number): number => Math.round(Math.min(100, Math.max(0, y)))

/** The note's banner: the renderer's banner image field (renamed by `keys`), else the `banner` key; `banner-y` clamped and rounded, 50 when missing. */
export function bannerOf(def: RendererDef, keys: Readonly<Record<string, string>>, frontmatter: Readonly<Record<string, unknown>>): Banner {
  const key = def.banner ? (keys[def.banner] ?? def.fields[def.banner]?.key ?? def.banner) : BANNER_KEY
  const parsed = wikiLinkSchema.safeParse(frontmatter[key])
  const rawY = frontmatter[BANNER_Y_KEY]
  const y = typeof rawY === 'number' && Number.isFinite(rawY) ? clamp(rawY) : 50
  return { key, link: parsed.success ? parsed.data : null, y, removable: def.id !== 'map' }
}
