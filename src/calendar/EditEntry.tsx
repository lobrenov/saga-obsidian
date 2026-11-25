import { useId, useState } from 'react'
import type { TFile } from 'obsidian'
import { DateEditor } from '../header/DateEditor'
import { HeaderCtx, type HeaderEnv } from '../header/env'
import type { NoteCalendar } from '../header/noteCalendar'
import type { CalendarDate } from '../shared/calendars/dates'
import { rendererDefs } from '../shared/renderers/definitions'
import type { RendererId } from '../shared/renderers/ids'
import type { Config } from '../shared/schemas/config'
import type { EntryDraft } from './entryActions'

export interface EditEntryProps {
  env: HeaderEnv
  config: Config
  file: TFile
  renderer: RendererId
  /** The entry's kind, for the Update button. */
  noun: string
  calendar: NoteCalendar
  initial: EntryDraft
  /** Writes the draft; resolves with why it was not saved, or null. */
  onSave: (draft: EntryDraft) => Promise<string | null>
  onDone: () => void
}

const DATES = [rendererDefs.lore.fields.when, rendererDefs.lore.fields.end] as const

/** The edit dialog's body: the note's title, When and Ends, written together by Update (or Mod+Enter). */
export function EditEntry({ env, config, file, renderer, noun, calendar, initial, onSave, onDone }: EditEntryProps) {
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const titleId = useId()
  const dateIds = [useId(), useId()]
  const errorId = useId()

  const save = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    const reason = await onSave(draft)
    setSaving(false)
    if (reason === null) onDone()
    else setError(reason)
  }
  const change = (next: Partial<EntryDraft>): void => {
    setDraft({ ...draft, ...next })
    setError(null)
  }

  return (
    <HeaderCtx.Provider value={{ env, file, config, renderer }}>
      <div
        className="saga-header saga-entry-edit"
        data-renderer={renderer}
        onKeyDown={(event) => {
          // Inside a date picker, Enter picks; the draft saves from the dialog's own controls.
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !(event.target as Element).closest('.saga-lore-popover')) {
            event.preventDefault()
            void save()
          }
        }}
      >
        <div className="saga-entry-edit-row">
          <label htmlFor={titleId} className="saga-header-label">
            Title
          </label>
          <input
            id={titleId}
            type="text"
            className="saga-header-input"
            value={draft.title}
            aria-describedby={error !== null ? errorId : undefined}
            onChange={(event) => change({ title: event.currentTarget.value })}
          />
        </div>
        {DATES.map((field, i) => {
          const key = field.prefix === '' ? 'when' : 'end'
          return (
            <div key={key} className="saga-entry-edit-row">
              <label htmlFor={dateIds[i]} className="saga-header-label">
                {field.label}
              </label>
              <div className="saga-header-control">
                <DateEditor
                  field={field}
                  value={draft[key]}
                  onChange={(value: CalendarDate | undefined) => change({ [key]: value })}
                  id={dateIds[i] ?? ''}
                  invalid={false}
                  describedBy={undefined}
                  placeholder=""
                  update={() => {}}
                  calendar={calendar}
                />
              </div>
            </div>
          )
        })}
        {error !== null ? (
          <p id={errorId} role="alert" className="saga-header-hint">
            {error}
          </p>
        ) : null}
        <button type="button" className="mod-cta saga-entry-edit-save" disabled={saving} onClick={() => void save()}>
          Update {noun}
        </button>
      </div>
    </HeaderCtx.Provider>
  )
}
