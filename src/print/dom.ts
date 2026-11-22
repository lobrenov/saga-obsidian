/** Every selector the print block relies on in Obsidian's markup (not part of the API): core's Export to PDF renders into `.print > .markdown-preview-view`. */

const PRINT_ROOT = '.print .markdown-preview-view'

/** The print root holding `el`, or null when `el` is not being exported. */
export const printRootOf = (el: HTMLElement): HTMLElement | null => el.closest<HTMLElement>(PRINT_ROOT)
