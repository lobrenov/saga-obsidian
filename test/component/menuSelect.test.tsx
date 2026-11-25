import { expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { MenuSelect } from '../../src/ui/MenuSelect'
import type { ShowMenu } from '../../src/ui/menu'

test('a second click on the button closes its menu without opening it again', async () => {
  let opened = 0
  // Closes on the next pointer down outside the menu, as Obsidian's menu does.
  const showMenu: ShowMenu = (_at, _items, onHide) => {
    opened++
    document.addEventListener('pointerdown', () => onHide?.(), { capture: true, once: true })
  }
  const screen = await render(<MenuSelect label="Side" value="after" options={[{ value: 'before', label: 'Before' }, { value: 'after', label: 'After' }]} showMenu={showMenu} onChange={() => {}} />)
  const button = screen.getByRole('button', { name: 'Side' })
  await userEvent.click(button)
  expect(opened).toBe(1)
  await userEvent.click(button)
  expect(opened).toBe(1)
  await userEvent.click(button)
  expect(opened).toBe(2)
})
