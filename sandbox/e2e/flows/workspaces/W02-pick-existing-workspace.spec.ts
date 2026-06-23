import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, SEED } from '../../../config'

test.describe('@flow @feature:workspaces @readonly W02 — Pick an existing workspace', () => {
  test('Selecting the seeded admins workspace lands on Home', async ({ page }) => {
    // Ensure the picker is shown by clearing any persisted workspace.
    await page.goto(`${FRONTEND_URL}/user/workspaces`)
    await page.evaluate(() => {
      try { localStorage.removeItem('workspace') } catch {}
      try { sessionStorage.removeItem('workspace') } catch {}
    })
    await page.goto(`${FRONTEND_URL}/user/workspaces`)

    await expect(page.getByRole('heading', { name: 'Select a workspace' })).toBeVisible()
    const tile = page.getByRole('button', {
      name: new RegExp(`${SEED.workspace.name}\\s*-\\s*${SEED.workspace.id} as superadmin`),
    })
    await expect(tile).toBeVisible()
    await tile.click()

    await page.waitForURL(new RegExp(`${new URL(FRONTEND_URL).host}/?(?:$|\\?)`), {
      timeout: 30_000,
    })
    await expect(page.getByRole('heading', { name: /^Home$/ })).toBeVisible({ timeout: 30_000 })
    // localStorage.workspace persisted = the seeded admins id
    const persisted = await page.evaluate(() => localStorage.getItem('workspace'))
    expect(persisted).toBe(SEED.workspace.id)
  })
})
