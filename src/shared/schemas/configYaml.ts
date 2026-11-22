import { Document, isCollection, isMap, parseDocument, type YAMLMap } from 'yaml'
import { rendererDefs } from '../renderers/definitions'
import { RENDERER_IDS } from '../renderers/ids'
import type { Fields } from '../renderers/fields'
import { err, ok, type Result } from '../result'
import { parseConfig, type Config, type RendererConfig } from './config'

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

function mapAt(doc: Document, path: string[]): YAMLMap | null {
  const node = doc.getIn(path, true)
  return isMap(node) ? node : null
}

/** Sets `path` to a flow-style value unless it already holds that value (so its comments survive). */
function setFlow(doc: Document, path: string[], value: unknown): void {
  if (same(doc.getIn(path), value)) return
  const node = doc.createNode(value)
  if (isCollection(node)) node.flow = true
  doc.setIn(path, node)
}

/**
 * The text of `.saga/renderers.yaml` after applying to `existing` (null: no file yet) what changed between `base` and `config`.
 * Only paths whose value differs are written, so everything the edit did not touch (unknown keys, unknown renderers,
 * entries Saga could not read, comments, key order) survives, and a document that comes out unchanged is returned verbatim.
 * `base` defaults to what `existing` says. Only renamed keys are written under `keys`; a renderer with nothing to say is not created.
 */
export function applyConfigToYaml(existing: string | null, config: Config, base?: Config): Result<string> {
  const doc = existing === null || existing.trim() === '' ? new Document({}) : parseDocument(existing)
  if (doc.errors.length > 0) return err({ kind: 'parse', message: `renderers.yaml: ${doc.errors[0]?.message ?? 'invalid YAML'}` })
  const options = { flowCollectionPadding: false }
  const before = existing === null ? null : doc.toString(options)
  if (!isMap(doc.contents)) {
    if (doc.contents !== null) return err({ kind: 'parse', message: 'renderers.yaml: expected a mapping at the top level' })
    doc.contents = doc.createNode({})
  }
  const from: Config = base ?? parseConfig(existing === null ? null : doc.toJS()).config

  if (config.typeKey !== from.typeKey) doc.set('typeKey', config.typeKey)

  for (const id of RENDERER_IDS) {
    const entry = config.renderers[id]
    if (!entry) continue
    const old: RendererConfig = from.renderers[id] ?? { types: [], keys: {}, templates: [] }
    const path = ['renderers', id]
    const fields = rendererDefs[id].fields as Fields
    const keyOf = (e: typeof entry, field: string): string => e.keys[field] ?? fields[field]?.key ?? field
    const renamed = Object.keys(fields).filter((field) => keyOf(entry, field) !== keyOf(old, field))
    const pinKeys = (['shape', 'color', 'icon'] as const).filter((key) => entry.pin?.[key] !== old.pin?.[key])
    const typesChanged = !same(entry.types, old.types)
    const templatesChanged = !same(entry.templates, old.templates)
    if (!typesChanged && !templatesChanged && renamed.length === 0 && pinKeys.length === 0) continue
    if (mapAt(doc, path) === null) doc.setIn(path, doc.createNode({}))

    if (typesChanged) setFlow(doc, [...path, 'types'], entry.types)
    if (templatesChanged) setFlow(doc, [...path, 'templates'], entry.templates)
    for (const field of renamed) {
      const keyPath = [...path, 'keys', field]
      if (entry.keys[field] === undefined || entry.keys[field] === fields[field]?.key) doc.deleteIn(keyPath)
      else {
        if (!mapAt(doc, [...path, 'keys'])) setFlow(doc, [...path, 'keys'], {})
        doc.setIn(keyPath, entry.keys[field])
      }
    }
    if (mapAt(doc, [...path, 'keys'])?.items.length === 0) doc.deleteIn([...path, 'keys'])
    for (const key of pinKeys) {
      const value = entry.pin?.[key]
      if (value === undefined) doc.deleteIn([...path, 'pin', key])
      else {
        if (!mapAt(doc, [...path, 'pin'])) setFlow(doc, [...path, 'pin'], {})
        doc.setIn([...path, 'pin', key], value)
      }
    }
    if (mapAt(doc, [...path, 'pin'])?.items.length === 0) doc.deleteIn([...path, 'pin'])
  }
  const after = doc.toString(options)
  return ok(existing !== null && after === before ? existing : after)
}
