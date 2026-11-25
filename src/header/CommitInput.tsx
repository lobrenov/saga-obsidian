import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  /** Called with a changed text on blur or Enter; returning or resolving to `false` puts the shown value back. */
  onCommit: (text: string) => void | boolean | Promise<boolean | void>
}

/** A text input that commits on blur or Enter; Escape puts the value back. It follows `value` when that changes. */
export function CommitInput({ value, onCommit, onBlur, onKeyDown, autoFocus, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  const latest = useRef({ draft, value })
  latest.current.value = value
  useLayoutEffect(() => {
    if (autoFocus) input.current?.focus()
  }, [])
  if (seen !== value) {
    setSeen(value)
    setDraft(value)
    latest.current.draft = value
  }
  const show = (text: string): void => {
    latest.current.draft = text
    setDraft(text)
  }
  return (
    <input
      type="text"
      autoComplete="off"
      spellCheck={false}
      {...props}
      ref={input}
      value={draft}
      onChange={(event) => show(event.currentTarget.value)}
      onBlur={(event) => {
        const { draft: text, value: saved } = latest.current
        if (text !== saved) void Promise.resolve(onCommit(text)).then((keep) => keep === false && show(latest.current.value))
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          show(latest.current.value)
          event.currentTarget.blur()
        }
        onKeyDown?.(event)
      }}
    />
  )
}
