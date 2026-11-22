/** Every selector and class the banner relies on in Obsidian's markup (not part of the API); the rest of `banner/` never queries the view's DOM. */

export const ACTIVE_CLASS = 'saga-banner-active'
export const SCROLLED_CLASS = 'saga-banner-scrolled'

const SIZER: Record<'live' | 'reading', string> = {
  live: '.cm-scroller > .cm-sizer',
  reading: '.markdown-preview-view > .markdown-preview-sizer'
}
const SCROLLER: Record<'live' | 'reading', string> = {
  live: '.cm-scroller',
  reading: '.markdown-preview-view'
}
const TITLE = '.inline-title'

/** Puts `host` before the view's sizer, in the scroller; false when the sizer is not in the DOM (yet). */
export function placeBanner(containerEl: HTMLElement, host: HTMLElement, mode: 'live' | 'reading'): boolean {
  const sizer = containerEl.querySelector(SIZER[mode])
  const scroller = sizer?.parentElement
  if (!sizer || !scroller) return false
  if (host.parentElement !== scroller || host.nextElementSibling !== sizer) scroller.insertBefore(host, sizer)
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

/** Toggles the scrolled class on the view while its scroller is scrolled past `host`; returns the stop function, which clears the class. */
export function watchScroll(containerEl: HTMLElement, host: HTMLElement, mode: 'live' | 'reading'): () => void {
  const update = (): void => {
    const scroller = containerEl.querySelector(SCROLLER[mode])
    containerEl.classList.toggle(SCROLLED_CLASS, scroller !== null && host.offsetHeight > 0 && scroller.scrollTop >= host.offsetHeight)
  }
  // Scroll events do not bubble; capturing at the view catches whichever scroller Obsidian currently has.
  const onScroll = (event: Event): void => {
    if (event.target instanceof Element && event.target.matches(SCROLLER[mode])) update()
  }
  containerEl.addEventListener('scroll', onScroll, true)
  update()
  return () => {
    containerEl.removeEventListener('scroll', onScroll, true)
    containerEl.classList.remove(SCROLLED_CLASS)
  }
}
