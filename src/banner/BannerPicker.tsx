import { FileInput } from '../header/fieldEditors'

/** A small popover holding the image suggester input; Esc or leaving the input closes it (`refocus`: nothing else took the focus). */
export function BannerPicker({ onPick, onClose }: { onPick: (target: string) => void; onClose: (refocus: boolean) => void }) {
  return (
    <div className="saga-banner-popover" role="group" aria-label="Choose banner image">
      <FileInput
        kind="image"
        className="saga-header-input"
        placeholder="Find an image…"
        aria-label="Banner image"
        autoFocus
        onPick={onPick}
        onBlur={(event) => {
          // A click on a suggestion must reach it before the popover goes.
          if (event.relatedTarget instanceof Element && event.relatedTarget.closest('.suggestion-container')) return
          onClose(event.relatedTarget === null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose(true)
          }
        }}
      />
    </div>
  )
}
