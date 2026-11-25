import type { TFile } from 'obsidian'
import type { CalendarHost } from './host'

interface NoteLinkProps {
  host: CalendarHost
  file: TFile
  className?: string
  /** Marks the link the entry card focuses first. */
  'data-autofocus'?: boolean
  children: string
}

/** A link to a note that opens it (in a new tab with Ctrl or Cmd) and shows its hover preview. */
export function NoteLink({ host, file, className, children, ...rest }: NoteLinkProps) {
  return (
    <a
      {...rest}
      href={file.path}
      className={className ? `internal-link ${className}` : 'internal-link'}
      onClick={(event) => {
        event.preventDefault()
        host.openNote(file, event.metaKey || event.ctrlKey)
      }}
      onMouseOver={(event) => host.hoverNote(event.nativeEvent, event.currentTarget, file)}
    >
      {children}
    </a>
  )
}
