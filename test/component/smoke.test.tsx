import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

it('renders React in the browser project', async () => {
  const screen = await render(<button type="button">Saga</button>)
  await expect.element(screen.getByRole('button', { name: 'Saga' })).toBeVisible()
})
