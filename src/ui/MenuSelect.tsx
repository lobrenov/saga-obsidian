import { useRef } from 'react'
import type { ShowMenu } from './menu'

export interface MenuOption {
  value: string
  label: string
}

interface MenuSelectProps {
  id?: string
  /** The accessible name when no `<label>` points at the button. */
  label?: string
  className?: string
  value: string | undefined
  options: readonly MenuOption[]
  /** Shown while no option is chosen. */
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  describedBy?: string | undefined
  showMenu: ShowMenu
  /** Called with a choice other than the current value. */
  onChange: (value: string) => void
}

/** A dropdown button that opens a menu of `options` below it, the current one checked. */
export function MenuSelect({ id, label, className, value, options, placeholder, disabled, invalid, describedBy, showMenu, onChange }: MenuSelectProps) {
  const current = options.find((option) => option.value === value)
  const open = useRef(false)
  /** Whether the menu was open when the current click began, so the click only closes it. */
  const closing = useRef(false)
  return (
    <button
      type="button"
      id={id}
      aria-label={label}
      className={className ? `dropdown saga-menu-select ${className}` : 'dropdown saga-menu-select'}
      aria-haspopup="menu"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      disabled={disabled}
      onPointerDown={() => {
        closing.current = open.current
      }}
      onClick={(event) => {
        if (closing.current) {
          closing.current = false
          return
        }
        const box = event.currentTarget.getBoundingClientRect()
        showMenu(
          { x: box.left, y: box.bottom, width: box.width, overlap: true },
          options.map((option) => ({
            title: option.label,
            checked: option.value === value,
            onClick: () => {
              if (option.value !== value) onChange(option.value)
            }
          })),
          // Cleared a task later: a pointer down on the button that closes the menu still sees it open.
          () => window.setTimeout(() => (open.current = false))
        )
        open.current = true
      }}
    >
      {current?.label ?? placeholder}
    </button>
  )
}
