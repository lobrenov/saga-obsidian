import type { Validated } from '../result'
import type { Fields } from './fields'

/** Names of the required fields that are missing or invalid. A note is compatible with its renderer when this is empty. */
export function missingRequired(renderer: { fields: Fields }, values: Readonly<Record<string, Validated<unknown>>>): string[] {
  return Object.entries(renderer.fields)
    .filter(([name, field]) => field.required && ((values[name]?.issues.length ?? 0) > 0 || values[name]?.value === undefined))
    .map(([name]) => name)
}
