/** Every selector and class the banner relies on in Obsidian's markup (not part of the API); the rest of `banner/` never queries the view's DOM. */

export const ACTIVE_CLASS = 'saga-banner-active'
export const SCROLLED_CLASS = 'saga-banner-scrolled'
export const SCROLLER_CLASS = 'saga-banner-scroller'

const SIZER: Record<'live' | 'reading', string> = {
  live: '.cm-scroller > .cm-sizer',
  reading: '.markdown-preview-view > .markdown-preview-sizer'
}
const TITLE = '.inline-title'
const LEAF = '.workspace-leaf-content'
const VIEW_HEADER = '.view-header'

/** Puts `host` before the view's sizer, in the scroller, which gets `SCROLLER_CLASS`; false when the sizer is not in the DOM (yet). */
export function placeBanner(containerEl: HTMLElement, host: HTMLElement, mode: 'live' | 'reading'): boolean {
  const sizer = containerEl.querySelector(SIZER[mode])
  const scroller = sizer?.parentElement
  if (!sizer || !scroller) return false
  if (host.parentElement !== scroller || host.nextElementSibling !== sizer) scroller.insertBefore(host, sizer)
  scroller.classList.add(SCROLLER_CLASS)
  return true
}

/** Puts `host` right after the view's inline title; false when there is none (yet). */
export function placeAdd(containerEl: HTMLElement, host: HTMLElement, mode: 'live' | 'reading'): boolean {
  const title = containerEl.querySelector(`${SIZER[mode]} ${TITLE}`)
  if (!title) return false
  if (title.nextElementSibling !== host) title.after(host)
  return true
}

/** Marks the view as showing a banner: the view header lies over the content and the sizer leaves room for the banner. */
export function markBanner(containerEl: HTMLElement, active: boolean): void {
  containerEl.classList.toggle(ACTIVE_CLASS, active)
}

/** The leaf's content element around `el`; `el` itself when it is in none. */
export function leafOf(el: Element): Element {
  return el.closest(LEAF) ?? el
}

/** Toggles the scrolled class on the view while content of the scroller holding `host` would reach the view header (past the banner less its overlap and the header's height); returns the stop function, which clears the class. */
export function watchScroll(containerEl: HTMLElement, host: HTMLElement): () => void {
  const update = (): void => {
    const scroller = host.parentElement
    const overlap = Number.parseFloat(getComputedStyle(host).getPropertyValue('--saga-banner-overlap')) || 0
    const header = containerEl.querySelector<HTMLElement>(VIEW_HEADER)?.offsetHeight ?? 0
    const reach = Math.max(0, host.offsetHeight - overlap - header)
    containerEl.classList.toggle(SCROLLED_CLASS, scroller !== null && host.offsetHeight > 0 && scroller.scrollTop >= reach)
  }
  // Scroll events do not bubble; capturing at the view catches the scroller that holds the banner, not one of an embed.
  const onScroll = (event: Event): void => {
    if (event.target === host.parentElement) update()
  }
  containerEl.addEventListener('scroll', onScroll, true)
  update()
  return () => {
    containerEl.removeEventListener('scroll', onScroll, true)
    containerEl.classList.remove(SCROLLED_CLASS)
  }
}
