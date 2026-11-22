import { FileInput } from '../header/fieldEditors'

/** A small popover holding the image suggester input; Esc or leaving the input closes it. */
export function BannerPicker({ onPick, onClose }: { onPick: (target: string) => void; onClose: () => void }) {
  return (
    <div className="saga-banner-popover">
      <FileInput
        kind="image"
        className="saga-header-input"
        placeholder="Find an image…"
        aria-label="Banner image"
        autoFocus
        onPick={onPick}
        onBlur={onClose}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
        }}
      />
    </div>
  )
}
