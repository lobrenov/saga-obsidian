import type { Issue, Validated } from '../result'
import { fieldSchema, type FieldValue, type Fields } from '../renderers/fields'
import { zodIssues } from './issues'

export type FieldLayer<F extends Fields> = { [K in keyof F]: Validated<FieldValue<F[K]>> }

/** Frontmatter in two layers: every raw key/value is kept, and each renderer field is validated on its own. */
export interface FrontmatterLayers<F extends Fields> {
  raw: Readonly<Record<string, unknown>>
  fields: FieldLayer<F>
}

/** `keys` renames fields to note keys (field name -> note key); unnamed fields use their default key. */
export function readFrontmatter<F extends Fields>(
  renderer: { fields: F },
  raw: Readonly<Record<string, unknown>>,
  keys: Readonly<Record<string, string>> = {}
): FrontmatterLayers<F> {
  const fields: Record<string, Validated<unknown>> = {}
  for (const [name, field] of Object.entries(renderer.fields)) {
    const key = keys[name] ?? field.key
    const input = raw[key]
    if (input === undefined || input === null) {
      const issues: Issue[] = field.required ? [{ path: key, message: 'Required' }] : []
      fields[name] = { value: undefined, issues }
      continue
    }
    const parsed = fieldSchema(field).safeParse(input)
    fields[name] = parsed.success
      ? { value: parsed.data, issues: [] }
      : { value: undefined, issues: zodIssues(parsed.error, key) }
  }
  return { raw, fields: fields as FieldLayer<F> }
}
