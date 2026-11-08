import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { useHeader } from './env'

const FORBIDDEN_NAME = /[\\/:*?"<>|#^[\]]/

/** The note's title as a heading that renames the note: click to edit, Enter commits, Escape cancels. The rename keeps the folder and Obsidian rewrites the links to it. */
export function NoteTitle() {
  const { env, file } = useHeader()
  const title = file.basename
  const [draft, setDraft] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const settled = useRef(false)
  const errorId = useId()

  const folder = file.path.slice(0, file.path.length - file.name.length)
  const target = `${folder}${draft?.trim() ?? title}.${file.extension}`
  const problem =
    draft === null
      ? null
      : draft.trim() === ''
        ? 'The name must not be empty'
        : FORBIDDEN_NAME.test(draft)
          ? 'The name must not contain \\ / : * ? " < > | # ^ [ ]'
          : target !== file.path && env.app.vault.getFileByPath(target)
            ? 'A note with this name already exists'
            : null
  const shown = problem ?? failure

  const stop = (): void => {
    settled.current = true
    setDraft(null)
    setFailure(null)
  }
  const commit = async (): Promise<void> => {
    if (draft === null || busy || settled.current) return
    if (draft.trim() === title) return stop()
    if (problem) return
    setBusy(true)
    try {
      await env.app.fileManager.renameFile(file, target)
      stop()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void commit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      stop()
    }
  }

  if (draft === null) {
    return (
      <h1 className="saga-header-title">
        <button
          type="button"
          title="Rename note"
          onClick={() => {
            settled.current = false
            setDraft(title)
          }}
        >
          {title}
        </button>
      </h1>
    )
  }
  return (
    <>
      <h1 className="saga-header-title">
        <input
          aria-label="Note name"
          aria-invalid={problem !== null || undefined}
          aria-describedby={shown ? errorId : undefined}
          value={draft}
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            setDraft(event.target.value)
            setFailure(null)
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (problem || failure) stop()
            else void commit()
          }}
        />
      </h1>
      {shown ? (
        <p id={errorId} role="alert" className="saga-header-hint">
          {shown}
        </p>
      ) : null}
    </>
  )
}
