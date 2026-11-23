import { z } from 'zod'
import { wikiLinkSchema, type WikiLink } from '../wikilink'

interface FieldBase {
  /** Default note (frontmatter) key; the config may rename it. */
  key: string
  label: string
  /** The header shows the field unless the renderer's config hides it. */
  optional?: boolean
}

type Plain<K extends 'text' | 'list' | 'link' | 'links' | 'image'> = FieldBase & { kind: K }

/** One member per kind, so `Extract<FieldDef, { kind: K }>` and narrowing on `kind` work. */
export type FieldDef =
  | Plain<'text'>
  | Plain<'list'>
  | Plain<'link'>
  | Plain<'links'>
  | Plain<'image'>
  | (FieldBase & { kind: 'choice'; options: readonly string[] })

export type FieldKind = FieldDef['kind']
export type Fields = Readonly<Record<string, FieldDef>>

interface KindValues {
  text: string
  list: string[]
  link: WikiLink
  links: WikiLink[]
  image: WikiLink
}

/** The value a field holds: choice is the union of its options. */
export type FieldValue<D extends FieldDef> = D extends { kind: 'choice'; options: readonly (infer O)[] }
  ? O
  : D extends { kind: infer K extends keyof KindValues }
    ? KindValues[K]
    : never

/** Runtime schema for one field's value. */
export function fieldSchema(field: FieldDef): z.ZodType {
  switch (field.kind) {
    case 'text':
      return z.string()
    case 'list':
      return z.array(z.string())
    case 'link':
    case 'image':
      return wikiLinkSchema
    case 'links':
      return z.array(wikiLinkSchema)
    case 'choice':
      return z.string().refine((s) => field.options.includes(s), { message: `Must be one of: ${field.options.join(', ')}` })
  }
}
