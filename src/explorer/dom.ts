/** Every selector and class the file icons rely on in Obsidian's file explorer markup (not part of the API); the rest of `explorer/` never queries the explorer's DOM. */

export const EXPLORER_VIEW = 'file-explorer'
const TITLE = '.nav-file-title[data-path], .nav-folder-title[data-path]'
const CONTENT = ':scope > .tree-item-inner'
const ICON_CLASS = 'saga-file-icon'

/** The file and folder titles in `root`, `root` included. */
export function titlesIn(root: Element): HTMLElement[] {
  const titles = Array.from(root.querySelectorAll<HTMLElement>(TITLE))
  return root.matches(TITLE) ? [root as HTMLElement, ...titles] : titles
}

export const isFolder = (title: Element): boolean => title.classList.contains('nav-folder-title')

export const pathOf = (title: Element): string => title.getAttribute('data-path') ?? ''

/** Puts `icon` before the title's name, replacing its icon unless equal; null removes it. */
export function setTitleIcon(title: HTMLElement, icon: HTMLElement | null): void {
  const current = title.querySelector(`:scope > .${ICON_CLASS}`)
  if (!icon) return current?.remove()
  icon.classList.add(ICON_CLASS)
  if (current?.isEqualNode(icon)) return
  if (current) current.replaceWith(icon)
  else title.insertBefore(icon, title.querySelector(CONTENT))
}

/** Removes every file icon in `root`. */
export function removeIcons(root: Element): void {
  for (const icon of Array.from(root.querySelectorAll(`.${ICON_CLASS}`))) icon.remove()
}
