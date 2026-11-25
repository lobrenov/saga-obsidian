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
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect()
        showMenu(
          { x: box.left, y: box.bottom, width: box.width, overlap: true },
          options.map((option) => ({
            title: option.label,
            checked: option.value === value,
            onClick: () => {
              if (option.value !== value) onChange(option.value)
            }
          }))
        )
      }}
    >
      {current?.label ?? placeholder}
    </button>
  )
}
