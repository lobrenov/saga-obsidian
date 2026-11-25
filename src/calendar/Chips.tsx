import { useId } from 'react'
import type { CalendarEntry } from './entries'
import type { Selection } from './MonthGrid'

export interface ChipsProps {
  label: string
  items: { entry: CalendarEntry; text: string }[]
  selected: Selection | null
  onSelect: (entry: CalendarEntry, slot: string) => void
}

/** A labelled row of entries as chips. */
export function Chips({ label, items, selected, onSelect }: ChipsProps) {
  const id = useId()
  if (items.length === 0) return null
  return (
    <div role="group" aria-labelledby={id} className="saga-calview-chips">
      <span id={id} className="saga-calview-chips-label">
        {label}
      </span>
      {items.map(({ entry, text }) => {
        const slot = `${label}|${entry.file.path}`
        return (
          <button
            key={entry.file.path}
            type="button"
            className="saga-calview-chip"
            aria-haspopup="dialog"
            aria-expanded={selected?.slot === slot}
            data-slot={slot}
            data-renderer={entry.renderer}
            data-entry={entry.file.path}
            data-problem={entry.start === undefined || undefined}
            data-selected={selected?.path === entry.file.path || undefined}
            onClick={() => onSelect(entry, slot)}
          >
            {text ? <span className="saga-calview-chip-when">{text}</span> : null}
            {entry.title}
          </button>
        )
      })}
    </div>
  )
}
