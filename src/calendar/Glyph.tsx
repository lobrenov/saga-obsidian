import { setIcon } from 'obsidian'

/** A Lucide icon drawn by Obsidian's `setIcon`. */
export function Glyph({ name }: { name: string }) {
  return (
    <span
      className="saga-calview-glyph"
      aria-hidden="true"
      ref={(el) => {
        if (el) setIcon(el, name)
      }}
    />
  )
}
