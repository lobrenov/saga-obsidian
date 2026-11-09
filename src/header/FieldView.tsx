import { useId, useState } from 'react'
import { setField, updateField } from '../obsidian/vault'
import type { FieldDef } from '../shared/renderers/fields'
import { convertRaw, toNoteValue } from '../shared/renderers/values'
import type { Validated } from '../shared/result'
import { useHeader } from './env'
import { renderEditor } from './fieldEditors'

export interface FieldViewProps {
  def: FieldDef
  /** The note key the field is stored under (after the config's renames). */
  noteKey: string
  /** The raw frontmatter value at `noteKey`. */
  raw: unknown
  layer: Validated<unknown>
  className?: string | undefined
}

const present = (value: unknown): boolean => value !== undefined && value !== null

/**
 * One field of the note: its editor, writing only `noteKey` through `setField` (a cleared field removes its key).
 * A value that fails the field's schema is shown raw with its issue and a Convert action when a safe conversion exists.
 */
export function FieldView({ def, noteKey, raw, layer, className }: FieldViewProps) {
  const { env, file } = useHeader()
  const id = useId()
  const hint = useId()
  const [error, setError] = useState<string | null>(null)
  const write = (value: unknown): void => {
    void setField(env.app, file, noteKey, value).then((result) => setError(result.ok ? null : `Could not update “${noteKey}”: ${result.error.message}`))
  }

  const update = (change: (current: unknown[]) => unknown[]): void => {
    void updateField(env.app, file, noteKey, (current) => change(Array.isArray(current) ? current : [])).then((result) =>
      setError(result.ok ? null : `Could not update “${noteKey}”: ${result.error.message}`)
    )
  }

  const invalid = present(raw) && layer.issues.length > 0
  const converted = invalid ? convertRaw(def, raw) : undefined

  const editor = renderEditor(def, {
    id,
    invalid,
    describedBy: invalid ? hint : undefined,
    placeholder: def.kind === 'choice' ? `Choose ${def.label.toLowerCase()}…` : `Add ${def.label.toLowerCase()}…`,
    update,
    value: layer.value,
    onChange: (value) => write(toNoteValue(value))
  })

  return (
    <div className={`saga-header-field ${className ?? ''}`} data-field={noteKey} data-kind={def.kind} data-empty={present(raw) ? undefined : ''}>
      {invalid && converted !== undefined ? (
        <div role="group" aria-labelledby={`${id}-label`} aria-describedby={hint}>
          <span id={`${id}-label`} className="saga-header-label">
            {def.label}
          </span>
          <div className="saga-header-raw">
            <code>{JSON.stringify(raw)}</code>
            <button type="button" aria-label={`Convert ${def.label}`} onClick={() => write(converted)}>
              Convert
            </button>
            <p id={hint}>{layer.issues[0]?.message ?? 'Invalid value'}</p>
          </div>
        </div>
      ) : (
        <>
          <label htmlFor={id} className="saga-header-label">
            {def.label}
          </label>
          {invalid ? (
            <div className="saga-header-raw">
              <code>{JSON.stringify(raw)}</code>
              <p id={hint}>{layer.issues[0]?.message ?? 'Invalid value'}</p>
            </div>
          ) : null}
          <div className="saga-header-control">{editor}</div>
        </>
      )}
      {error ? (
        <p role="alert" className="saga-header-hint">
          {error}
        </p>
      ) : null}
    </div>
  )
}
