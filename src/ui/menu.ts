import { Menu } from 'obsidian'

export interface MenuItem {
  title: string
  icon?: string
  /** Drawn as a destructive action. */
  warning?: boolean
  /** Drawn with a check mark when true. */
  checked?: boolean
  onClick: () => void
}

/** Where a menu opens: a screen point, the width of the control it opens from, and whether it opens over that control instead of beside it. */
export interface MenuAt {
  x: number
  y: number
  width?: number
  overlap?: boolean
}

/** Opens a menu; `parent` has the `has-active-menu` class while it is open. */
export type ShowMenu = (at: MenuAt, items: MenuItem[], parent?: HTMLElement) => void

/** Opens an Obsidian menu, which Obsidian draws natively when its native menus setting is on. */
export const showMenu: ShowMenu = (at, items, parent) => {
  const menu = new Menu()
  for (const entry of items) {
    menu.addItem((item) => {
      item.setTitle(entry.title).onClick(entry.onClick)
      if (entry.icon) item.setIcon(entry.icon)
      if (entry.checked !== undefined) item.setChecked(entry.checked)
      if (entry.warning) item.setWarning(true)
    })
  }
  if (parent) menu.setParentElement(parent)
  menu.showAtPosition(at)
}
