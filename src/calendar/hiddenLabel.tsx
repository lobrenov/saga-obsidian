import { useId, type ReactNode } from 'react'

/** A name for `aria-labelledby` that is read but not shown: Obsidian draws an `aria-label` as a tooltip. */
export function useHiddenLabel(text: string): [string, ReactNode] {
  const id = useId()
  return [
    id,
    <span key={id} id={id} hidden>
      {text}
    </span>
  ]
}
