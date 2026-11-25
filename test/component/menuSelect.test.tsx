import { expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { MenuSelect } from '../../src/ui/MenuSelect'
import type { ShowMenu } from '../../src/ui/menu'

test('a click on the button while its menu is open leaves the closing to the menu; after a click away it opens again', async () => {
  let opened = 0
  // Marks its parent while open and closes on the next click anywhere, as Obsidian's menu does.
  const showMenu: ShowMenu = (_at, _items, parent) => {
    opened++
    parent?.classList.add('has-active-menu')
    window.setTimeout(() => window.addEventListener('click', () => parent?.classList.remove('has-active-menu'), { once: true }))
  }
  const screen = await render(
    <div>
      <MenuSelect label="Side" value="after" options={[{ value: 'before', label: 'Before' }, { value: 'after', label: 'After' }]} showMenu={showMenu} onChange={() => {}} />
      <p>Elsewhere</p>
    </div>
  )
  const button = screen.getByRole('button', { name: 'Side' })
  await userEvent.click(button)
  expect(opened).toBe(1)
  await expect.element(button).toHaveClass('has-active-menu')
  await userEvent.click(button)
  expect(opened).toBe(1)
  await expect.element(button).not.toHaveClass('has-active-menu')
  await userEvent.click(button)
  await userEvent.click(screen.getByText('Elsewhere'))
  await userEvent.click(button)
  expect(opened).toBe(3)
})
