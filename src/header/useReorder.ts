import { useRef, useState, type DragEvent } from 'react'

const MIME = 'application/x-saga-calendar-row'

/** Drag-and-drop reordering: spread `grip(i)` on the element dragged from and `row(i)` on the element dropped onto; `over` is the row being hovered. `focusAt(i)` has the grip at `i` take focus once drawn, for keyboard moves. */
export function useReorder(move: (from: number, to: number) => void) {
  const from = useRef<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const [focus, setFocus] = useState<number | null>(null)
  return {
    over,
    focus,
    focusAt: setFocus,
    grip: (index: number) => ({
      draggable: true,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        from.current = index
        event.dataTransfer?.setData(MIME, String(index))
        const row = event.currentTarget.closest('[data-reorder]')
        if (row) event.dataTransfer?.setDragImage(row, 0, 0)
      },
      onDragEnd: () => {
        from.current = null
        setOver(null)
      }
    }),
    row: (index: number) => ({
      'data-reorder': '',
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (from.current === null) return
        event.preventDefault()
        setOver(index)
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null)
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault()
        const start = from.current
        from.current = null
        setOver(null)
        if (start !== null && start !== index) move(start, index)
      }
    })
  }
}
