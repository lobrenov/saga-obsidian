import type { RendererId } from '../renderers/ids'
import { err, type Result } from '../result'
import { parseConfig, type Config } from './config'
import { applyConfigToYaml } from './configYaml'

/**
 * The text of `.saga/renderers.yaml` after saving `config` (edited from `base`) over `existing` (null: no file yet).
 * Refused with the issues when `config` is invalid or changes an entry in `invalid` (one that could not be read).
 */
export function buildConfigText(existing: string | null, config: Config, base: Config, invalid: readonly RendererId[]): Result<string> {
  const issues = parseConfig(config).issues
  if (issues.length > 0) return err({ kind: 'validation', message: issues[0]?.message ?? 'Invalid configuration', issues })
  const unreadable = invalid.filter((id) => JSON.stringify(config.renderers[id]) !== JSON.stringify(base.renderers[id]))
  if (unreadable.length > 0) {
    const found = unreadable.map((id) => ({ path: `renderers.${id}`, message: `The "${id}" entry in renderers.yaml could not be read; fix it in the file` }))
    return err({ kind: 'validation', message: found[0]?.message ?? 'Unreadable entry', issues: found })
  }
  return applyConfigToYaml(existing, config, base)
}
