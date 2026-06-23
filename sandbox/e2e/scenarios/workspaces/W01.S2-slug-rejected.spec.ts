import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'

test.describe('@scenario @feature:workspaces @invariant @readonly W01.S2 — Slug rejected', () => {
  test('Invalid Workspace ID disables the Create workspace button', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/user/create_workspace`)
    await expect(page.getByRole('heading', { name: 'New Workspace' })).toBeVisible()

    await page.getByLabel(/Workspace name/i).fill('Acme')
    const idField = page.getByLabel(/Workspace ID/i)
    await idField.fill('')
    await idField.fill('Invalid ID!')

    const create = page.getByRole('button', { name: /^Create workspace$/ })
    await expect(create).toBeDisabled({ timeout: 5_000 })

    // Sanity: a valid slug re-enables the button.
    await idField.fill('')
    await idField.fill('valid-slug-1')
    await expect(create).toBeEnabled({ timeout: 5_000 })
  })
})
