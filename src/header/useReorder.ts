import { useRef, useState, type DragEvent } from 'react'

/** Drag-and-drop reordering: spread `grip(i)` on the element dragged from and `row(i)` on the element dropped onto; `over` is the row being hovered. */
export function useReorder(move: (from: number, to: number) => void) {
  const from = useRef<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  return {
    over,
    grip: (index: number) => ({
      draggable: true,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        from.current = index
        event.dataTransfer?.setData('text/plain', String(index))
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
