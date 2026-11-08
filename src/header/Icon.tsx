import { useHeader } from './env'

/** A lucide icon drawn by Obsidian's `setIcon`. */
export function Icon({ name, className }: { name: string; className?: string }) {
  const { env } = useHeader()
  return (
    <span
      className={`saga-header-icon ${className ?? ''}`}
      aria-hidden="true"
      ref={(el) => {
        if (el) env.setIcon(el, name)
      }}
    />
  )
}
