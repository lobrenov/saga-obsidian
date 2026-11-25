import { PIN_DEFAULTS, rendererLook, type PinLook } from '../shared/pins/look'
import { rendererDefs } from '../shared/renderers/definitions'
import type { Fields } from '../shared/renderers/fields'
import { RENDERER_IDS, type RendererId } from '../shared/renderers/ids'
import { defaultTypes, typesOf } from '../shared/renderers/resolve'
import type { Result } from '../shared/result'
import { parseConfig, type Config, type RendererConfig } from '../shared/schemas/config'
import { buildConfigText } from '../shared/schemas/configWrite'

/** The renderers the tab edits; `document` is the fallback and has no types or fields of its own. */
export const EDITABLE_IDS = RENDERER_IDS.filter((id) => id !== 'document')

/** What the tab's inputs hold: `types` is comma-separated, a blank key stands for the field's default, `hidden` is true per optional field the header leaves out, `pin` is each renderer's pin look as drawn (built-ins under the configured keys). */
export interface Draft {
  typeKey: string
  types: Record<string, string>
  keys: Record<string, Record<string, string>>
  hidden: Record<string, Record<string, boolean>>
  pin: Record<string, PinLook>
}

const fieldsOf = (id: RendererId): Fields => rendererDefs[id].fields
const optionalFieldsOf = (id: RendererId): string[] => Object.keys(fieldsOf(id)).filter((field) => fieldsOf(id)[field]?.optional)

export function draftOf(config: Config): Draft {
  const types: Draft['types'] = {}
  const keys: Draft['keys'] = {}
  const hidden: Draft['hidden'] = {}
  for (const id of EDITABLE_IDS) {
    types[id] = typesOf(config, id).join(', ')
    keys[id] = Object.fromEntries(Object.keys(fieldsOf(id)).map((field) => [field, config.renderers[id]?.keys[field] ?? '']))
    hidden[id] = Object.fromEntries(optionalFieldsOf(id).map((field) => [field, config.renderers[id]?.hidden?.includes(field) ?? false]))
  }
  const pin = Object.fromEntries(RENDERER_IDS.map((id) => [id, rendererLook(id, config.renderers[id]?.pin)]))
  return { typeKey: config.typeKey, types, keys, hidden, pin }
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** The renderer's `pin` keys after the draft: a key left as drawn stays as `base` has it, a key equal to the built-in default is not written. */
function pinOf(draft: Draft, base: Config, id: RendererId): RendererConfig['pin'] {
  const before = base.renderers[id]?.pin
  const drawn = rendererLook(id, before)
  const pin: Record<string, string> = {}
  for (const key of ['shape', 'color', 'icon'] as const) {
    const value = (draft.pin[id] ?? drawn)[key]
    if (value === drawn[key]) {
      if (before?.[key] !== undefined) pin[key] = value
    } else if (value !== PIN_DEFAULTS[id][key]) pin[key] = value
  }
  return Object.keys(pin).length > 0 ? pin : undefined
}

function entryOf(draft: Draft, base: Config, id: RendererId): RendererConfig | undefined {
  const before = base.renderers[id]
  const listed = (draft.types[id] ?? '').split(',').map((type) => type.trim()).filter(Boolean)
  const types = listed.length > 0 ? listed : [...defaultTypes(id)]
  const typesChanged = !same(types, typesOf(base, id))
  const keys: Record<string, string> = {}
  for (const [field, def] of Object.entries(fieldsOf(id))) {
    const value = (draft.keys[id]?.[field] ?? '').trim()
    if (value === (before?.keys[field] ?? '')) {
      if (before && field in before.keys) keys[field] = value
    } else if (value !== '' && value !== def.key) keys[field] = value
  }
  const pin = pinOf(draft, base, id)
  const hidden = optionalFieldsOf(id).filter((field) => draft.hidden[id]?.[field])
  if (!before && !typesChanged && Object.keys(keys).length === 0 && !pin && hidden.length === 0) return undefined
  return { types: typesChanged ? types : (before?.types ?? []), keys, templates: before?.templates ?? [], ...(pin && { pin }), ...(hidden.length > 0 && { hidden }) }
}

/** The config the draft stands for over `base`: unedited entries (and `document`) stay as `base` has them. */
export function configOf(draft: Draft, base: Config): Config {
  const renderers: Config['renderers'] = { ...base.renderers }
  for (const id of EDITABLE_IDS) {
    const entry = entryOf(draft, base, id)
    if (entry) renderers[id] = entry
    else delete renderers[id]
  }
  const documentPin = pinOf(draft, base, 'document')
  if (documentPin || base.renderers.document) {
    const { types, keys, templates } = base.renderers.document ?? { types: [], keys: {}, templates: [] }
    renderers.document = { types, keys, templates, ...(documentPin && { pin: documentPin }) }
  }
  return { typeKey: draft.typeKey.trim(), renderers }
}

export const draftIssues = (draft: Draft, base: Config) => parseConfig(configOf(draft, base)).issues

/** The file text after saving `draft` over the file as read (`state.text`); refused with the issues when the config is invalid. */
export const saveText = (state: { config: Config; invalid: readonly RendererId[]; text: string | null }, draft: Draft): Result<string> =>
  buildConfigText(state.text, configOf(draft, state.config), state.config, state.invalid)

export const isDirty = (draft: Draft, base: Config): boolean => !same(draft, draftOf(base))

/** `draft` carried from `previous` to `next`: inputs the user edited keep their value, the rest take `next`'s. */
export function rebase(draft: Draft, previous: Config, next: Config): Draft {
  const was = draftOf(previous)
  const now = draftOf(next)
  const pick = <T extends string>(mine: T, before: T, after: T): T => (mine === before ? after : mine)
  const types: Draft['types'] = {}
  const keys: Draft['keys'] = {}
  const hidden: Draft['hidden'] = {}
  for (const id of EDITABLE_IDS) {
    types[id] = pick(draft.types[id] ?? '', was.types[id] ?? '', now.types[id] ?? '')
    hidden[id] = Object.fromEntries(
      Object.entries(now.hidden[id] ?? {}).map(([field, value]) => {
        const [mine, before] = [draft.hidden[id]?.[field] ?? false, was.hidden[id]?.[field] ?? false]
        return [field, mine === before ? value : mine]
      })
    )
    keys[id] = Object.fromEntries(
      Object.entries(now.keys[id] ?? {}).map(([field, value]) => [field, pick(draft.keys[id]?.[field] ?? '', was.keys[id]?.[field] ?? '', value)])
    )
  }
  const pin = Object.fromEntries(
    RENDERER_IDS.map((id) => {
      const [mine, before, after] = [draft.pin[id] ?? PIN_DEFAULTS[id], was.pin[id] ?? PIN_DEFAULTS[id], now.pin[id] ?? PIN_DEFAULTS[id]]
      return [id, { shape: pick(mine.shape, before.shape, after.shape), color: pick(mine.color, before.color, after.color), icon: pick(mine.icon, before.icon, after.icon) }]
    })
  )
  return { typeKey: pick(draft.typeKey, was.typeKey, now.typeKey), types, keys, hidden, pin }
}
