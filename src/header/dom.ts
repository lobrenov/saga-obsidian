/** Every selector and class the header relies on in Obsidian's markup (not part of the API); the rest of `header/` never queries the view's DOM. */

export type ViewMode = 'live' | 'reading' | 'source'

export const ACTIVE_CLASS = 'saga-header-active'
export const PROPERTIES_CLASS = 'saga-header-properties'

const SIZER: Record<'live' | 'reading', string> = {
  live: '.markdown-source-view .cm-sizer',
  reading: '.markdown-preview-view .markdown-preview-sizer'
}
const TITLE_BLOCK = ':scope > .mod-header, :scope > .inline-title'

/** The sizer's child the header goes before: the title block (`.inline-title`, or `.mod-header` in Reading view), else the first child other than the header. */
function anchorIn(sizer: Element, host: HTMLElement): Element | null {
  return sizer.querySelector(TITLE_BLOCK) ?? [...sizer.children].find((child) => child !== host) ?? null
}

/** Puts `host` before the title block of the view's sizer for `mode`; false when the sizer is not in the DOM (yet). */
export function placeHost(containerEl: HTMLElement, host: HTMLElement, mode: 'live' | 'reading'): boolean {
  const sizer = containerEl.querySelector(SIZER[mode])
  if (!sizer) return false
  const anchor = anchorIn(sizer, host)
  if (host.parentElement === sizer && host.nextElementSibling === anchor) return true
  sizer.insertBefore(host, anchor)
  return true
}

/** Marks the view as drawn by a header: its title and native properties hide (the properties show when `properties` is set). */
export function markActive(containerEl: HTMLElement, active: boolean, properties = false): void {
  containerEl.classList.toggle(ACTIVE_CLASS, active)
  containerEl.classList.toggle(PROPERTIES_CLASS, active && properties)
}

/** Keeps pointer clicks inside `host` from reaching Obsidian's editor and Reading view handlers; keys still bubble so hotkeys work. */
export function isolatePointer(host: HTMLElement): void {
  for (const type of ['mousedown', 'click'] as const) host.addEventListener(type, (event) => event.stopPropagation())
}

/** Calls `onMutation` when the sizer's children, or its parent's, change; until the sizer exists it watches the whole view. Returns the stop function. */
export function watchPlacement(containerEl: HTMLElement, mode: 'live' | 'reading', onMutation: () => void): () => void {
  const observer = new MutationObserver(() => {
    onMutation()
    retarget()
  })
  function retarget(): void {
    observer.disconnect()
    const sizer = containerEl.querySelector(SIZER[mode])
    if (!sizer) return observer.observe(containerEl, { childList: true, subtree: true })
    observer.observe(sizer, { childList: true })
    if (sizer.parentElement) observer.observe(sizer.parentElement, { childList: true })
  }
  retarget()
  return () => observer.disconnect()
}
