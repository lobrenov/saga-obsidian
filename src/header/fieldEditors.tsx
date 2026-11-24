import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { frontmatterOf, resolveLink, resourceUrl } from '../obsidian/vault'
import type { EditorProps, FieldEditors } from '../shared/renderers/define'
import { rendererDefs } from '../shared/renderers/definitions'
import type { FieldDef } from '../shared/renderers/fields'
import { createRendererResolver } from '../shared/renderers/resolve'
import { parseWikiLink, type WikiLink } from '../shared/wikilink'
import { useHeader } from './env'
import { MenuSelect } from '../ui/MenuSelect'
import { Icon } from './Icon'

/** What every field editor receives besides the field, its value and `onChange`. */
export interface EditorCtx {
  /** Id of the editor's primary control, for the field's `<label>`. */
  id: string
  invalid: boolean
  describedBy: string | undefined
  /** Shown while the field is empty, e.g. "Add title…". */
  placeholder: string
  /** Rewrites the field's raw array as written in the note at write time. */
  update: (change: (current: unknown[]) => unknown[]) => void
}

/** Quiet period after the last keystroke before a text edit is written. */
export const COMMIT_DELAY_MS = 600

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)
const withoutFirst = (list: unknown[], match: (entry: unknown) => boolean): unknown[] => {
  const at = list.findIndex(match)
  return at < 0 ? list : list.filter((_, i) => i !== at)
}
const targetOf = (entry: unknown): string | undefined => (typeof entry === 'string' ? parseWikiLink(entry)?.target : undefined)
const linkText = (link: WikiLink): string => link.target + (link.heading !== undefined ? `#${link.heading}` : '')

/**
 * A draft of the field's text. `written` is the last value known to be in the note (read or written); an incoming value replaces
 * the draft only when the field is not being edited, so the cache catching up with a write does not move the cursor.
 */
function useDraft(text: string) {
  const [draft, setDraft] = useState(text)
  const [seen, setSeen] = useState(text)
  const written = useRef(text)
  const focused = useRef(false)
  if (seen !== text) {
    setSeen(text)
    written.current = text
    if (!focused.current || draft === text) setDraft(text)
  }
  return { draft, setDraft, written, focused }
}

/** A text input that offers vault files and reports the picked file's link text. */
export function FileInput({ kind, onPick, autoFocus, ...props }: { kind: 'note' | 'image'; onPick: (target: string) => void } & React.InputHTMLAttributes<HTMLInputElement>) {
  const { env, file } = useHeader()
  const ref = useRef<HTMLInputElement>(null)
  const pick = useRef(onPick)
  pick.current = onPick
  const from = useRef(file.path)
  from.current = file.path
  const picked = useRef(false)
  useLayoutEffect(
    () =>
      ref.current
        ? env.suggest(ref.current, kind, () => from.current, (target) => {
            picked.current = true
            pick.current(target)
          })
        : undefined,
    [env, kind]
  )
  useLayoutEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [])
  return (
    <input
      ref={ref}
      type="text"
      autoComplete="off"
      spellCheck={false}
      {...props}
      onChange={(event) => {
        picked.current = false
        props.onChange?.(event)
      }}
      onKeyDown={(event) => {
        // Enter that chose a suggestion has already been committed.
        if (event.key === 'Enter' && (event.defaultPrevented || picked.current)) {
          picked.current = false
          return
        }
        props.onKeyDown?.(event)
      }}
    />
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="saga-header-chip-remove" aria-label={`Remove ${label}`} onClick={onClick}>
      <Icon name="x" />
    </button>
  )
}

function TextEditor({ value, onChange, id, invalid, describedBy, placeholder }: EditorProps<'text'> & EditorCtx) {
  const text = value ?? ''
  const { draft, setDraft, written, focused } = useDraft(text)
  const area = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef({ draft, onChange })
  latest.current = { draft, onChange }

  const commit = (): void => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    const next = latest.current.draft
    if (next === written.current) return
    written.current = next
    latest.current.onChange(next === '' ? undefined : next)
  }
  useEffect(
    () => () => {
      if (timer.current !== undefined) commit()
    },
    []
  )
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.removeProperty('height')
    el.setCssProps({ height: `${el.scrollHeight}px` })
  }, [draft])

  return (
    <textarea
      ref={area}
      id={id}
      className="saga-header-text"
      rows={1}
      value={draft}
      placeholder={placeholder}
      spellCheck={false}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onFocus={() => (focused.current = true)}
      onChange={(event) => {
        latest.current.draft = event.target.value
        setDraft(event.target.value)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(commit, COMMIT_DELAY_MS)
      }}
      onBlur={() => {
        focused.current = false
        commit()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          latest.current.draft = written.current
          setDraft(written.current)
          event.currentTarget.blur()
        }
      }}
    />
  )
}

function ListEditor({ value, id, invalid, describedBy, placeholder, update }: EditorProps<'list'> & EditorCtx) {
  const items = value ?? []
  const [draft, setDraft] = useState('')
  const add = (): void => {
    const item = draft.trim()
    setDraft('')
    if (item !== '') update((current) => [...current, item])
  }
  return (
    <div className="saga-header-list">
      {items.length > 0 ? (
        <ul className="saga-header-chips">
          {items.map((item, i) => (
            <li key={`${i}-${item}`} className="saga-header-chip">
              <span>{item}</span>
              <RemoveButton label={item} onClick={() => update((current) => withoutFirst(current, (entry) => entry === item))} />
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        type="text"
        className="saga-header-input"
        value={draft}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={add}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            add()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            setDraft('')
            event.currentTarget.blur()
          }
        }}
      />
    </div>
  )
}

/** A ghost button that opens an inline editor in place. */
function AddButton({ id, label, name, onClick }: { id: string; label: string; name: string; onClick: () => void }) {
  return (
    <button type="button" id={id} className="saga-header-add" aria-label={name} onClick={onClick}>
      <Icon name="plus" />
      {label}
    </button>
  )
}

/** A link as a chip: the linked note's renderer icon and title; click opens it (modifier-click: new tab), hover previews it. Edit and remove show on hover. */
function LinkChip({ link, editId, editLabel, removeLabel, onEdit, onRemove }: { link: WikiLink; editId?: string; editLabel?: string; removeLabel: string; onEdit?: () => void; onRemove: () => void }) {
  const { env, file, config } = useHeader()
  const resolved = resolveLink(env.app, link, file.path)
  const renderer = resolved ? createRendererResolver(config)(frontmatterOf(env.app, resolved)).renderer : null
  const target = linkText(link)
  return (
    <span className={`saga-header-chip${resolved ? '' : ' is-unresolved'}`} data-renderer={renderer ?? undefined}>
      <button
        type="button"
        className="saga-header-chip-link"
        onClick={(event) => env.openLink(target, file.path, event)}
        onMouseOver={(event) => env.hover(event.nativeEvent, event.currentTarget, target, file.path)}
      >
        <Icon name={renderer ? rendererDefs[renderer].icon : 'unlink'} />
        {link.alias ?? resolved?.basename ?? link.target}
      </button>
      {onEdit ? (
        <button type="button" id={editId} className="saga-header-chip-action" aria-label={editLabel} onClick={onEdit}>
          <Icon name="pencil" />
        </button>
      ) : null}
      <button type="button" className="saga-header-chip-action" aria-label={removeLabel} onClick={onRemove}>
        <Icon name="x" />
      </button>
    </span>
  )
}

function LinkEditor({ field, value, onChange, id, invalid, describedBy, placeholder }: EditorProps<'link'> & EditorCtx) {
  const text = value?.target ?? ''
  const { draft, setDraft, written, focused } = useDraft(text)
  const [editing, setEditing] = useState(false)
  const commit = (target: string): void => {
    const next = target.trim()
    setEditing(false)
    if (next === written.current) return
    written.current = next
    onChange(next === '' ? undefined : { target: next, embed: false })
  }
  if (!editing) {
    return value ? (
      <LinkChip link={value} editId={id} editLabel={`Edit ${field.label}`} removeLabel={`Clear ${field.label}`} onEdit={() => setEditing(true)} onRemove={() => commit('')} />
    ) : (
      <AddButton id={id} label={placeholder} name={placeholder} onClick={() => setEditing(true)} />
    )
  }
  return (
    <FileInput
      kind="note"
      id={id}
      className="saga-header-input"
      value={draft}
      placeholder={placeholder}
      autoFocus
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onPick={(target) => {
        setDraft(target)
        commit(target)
      }}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => {
        focused.current = true
        event.currentTarget.select()
      }}
      onBlur={(event) => {
        focused.current = false
        commit(event.currentTarget.value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit(draft)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          setDraft(text)
          setEditing(false)
        }
      }}
    />
  )
}

function LinksEditor({ value, id, invalid, describedBy, placeholder, update }: EditorProps<'links'> & EditorCtx) {
  const items = value ?? []
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const add = (target: string): void => {
    const next = target.trim()
    setDraft('')
    setAdding(false)
    if (next === '') return
    update((current) => (current.some((entry) => targetOf(entry)?.toLowerCase() === next.toLowerCase()) ? current : [...current, `[[${next}]]`]))
  }
  return (
    <div className="saga-header-chips">
      {items.map((item, i) => (
        <LinkChip key={`${i}-${item.target}`} link={item} removeLabel={`Remove ${item.target}`} onRemove={() => update((current) => withoutFirst(current, (entry) => targetOf(entry) === item.target))} />
      ))}
      {adding ? (
        <FileInput
          kind="note"
          id={id}
          className="saga-header-input"
          value={draft}
          placeholder={placeholder}
          autoFocus
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onPick={add}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => add(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add(draft)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setDraft('')
              setAdding(false)
            }
          }}
        />
      ) : (
        <AddButton id={id} label={items.length > 0 ? 'Add' : placeholder} name={placeholder} onClick={() => setAdding(true)} />
      )}
    </div>
  )
}

function ImageEditor({ field, value, onChange, id, invalid, describedBy, placeholder }: EditorProps<'image'> & EditorCtx) {
  const { env, file, renderer } = useHeader()
  const resolved = value ? resolveLink(env.app, value, file.path) : null
  const [query, setQuery] = useState<string | null>(null)
  const editing = query !== null
  const input = (
    <FileInput
      kind="image"
      id={id}
      className="saga-header-input"
      value={query ?? ''}
      placeholder={placeholder}
      autoFocus
      aria-invalid={invalid || (value !== undefined && resolved === null) || undefined}
      aria-describedby={describedBy}
      onPick={(target) => {
        setQuery(null)
        onChange({ target, embed: false })
      }}
      onChange={(event) => setQuery(event.target.value)}
      onBlur={() => setQuery(null)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          setQuery(null)
        }
      }}
    />
  )
  const icon = rendererDefs[renderer].icon
  return (
    <div className="saga-header-image">
      <div className="saga-header-frame" data-empty={value ? undefined : ''} data-missing={value && !resolved ? '' : undefined} data-add={resolved || value || editing ? undefined : ''}>
        {resolved ? (
          <img src={resourceUrl(env.app, resolved)} alt={field.label} />
        ) : value ? (
          <Icon name="image-off" />
        ) : editing ? (
          <Icon name={icon} />
        ) : (
          <button type="button" id={id} className="saga-header-frame-add" aria-label={placeholder} onClick={() => setQuery('')}>
            <Icon name={icon} />
            <span>Add {field.label.toLowerCase()}</span>
          </button>
        )}
        {value || editing ? (
          <div className="saga-header-image-controls" data-editing={editing || undefined}>
            {editing ? (
              input
            ) : (
              <>
                <button type="button" id={id} className="saga-header-chip-action" aria-label={`Change ${field.label.toLowerCase()}`} onClick={() => setQuery('')}>
                  <Icon name="pencil" />
                </button>
                <button type="button" className="saga-header-chip-action" aria-label={`Remove ${field.label.toLowerCase()}`} onClick={() => onChange(undefined)}>
                  <Icon name="trash-2" />
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
      {value && resolved === null ? <p className="saga-header-hint">{value.target} was not found in the vault.</p> : null}
    </div>
  )
}

function ChoiceEditor({ field, value, onChange, id, invalid, describedBy, placeholder }: EditorProps<'choice'> & EditorCtx) {
  const { env } = useHeader()
  return (
    <span className="saga-header-choice">
      <MenuSelect
        id={id}
        className="saga-header-select"
        value={value}
        options={field.options.map((option) => ({ value: option, label: capitalise(option) }))}
        placeholder={placeholder}
        invalid={invalid}
        describedBy={describedBy}
        showMenu={env.showMenu}
        onChange={onChange}
      />
      {value === undefined ? null : (
        <button type="button" className="saga-header-chip-action" aria-label={`Clear ${field.label}`} onClick={() => onChange(undefined)}>
          <Icon name="x" />
        </button>
      )}
    </span>
  )
}

/** One editor per field kind; a kind without an editor does not compile. */
export const fieldEditors: FieldEditors<ReactNode, EditorCtx> = {
  text: (props) => <TextEditor {...props} />,
  list: (props) => <ListEditor {...props} />,
  link: (props) => <LinkEditor {...props} />,
  links: (props) => <LinksEditor {...props} />,
  image: (props) => <ImageEditor {...props} />,
  choice: (props) => <ChoiceEditor {...props} />
}

/** Renders the editor for `field`'s kind. `value` has already passed the field's schema (or is undefined). */
export function renderEditor(field: FieldDef, props: EditorCtx & { value: unknown; onChange: (value: unknown) => void }): ReactNode {
  switch (field.kind) {
    case 'text':
      return fieldEditors.text({ ...props, field, value: props.value as string | undefined })
    case 'list':
      return fieldEditors.list({ ...props, field, value: props.value as string[] | undefined })
    case 'link':
      return fieldEditors.link({ ...props, field, value: props.value as WikiLink | undefined })
    case 'links':
      return fieldEditors.links({ ...props, field, value: props.value as WikiLink[] | undefined })
    case 'image':
      return fieldEditors.image({ ...props, field, value: props.value as WikiLink | undefined })
    case 'choice':
      return fieldEditors.choice({ ...props, field, value: props.value as string | undefined })
  }
}
