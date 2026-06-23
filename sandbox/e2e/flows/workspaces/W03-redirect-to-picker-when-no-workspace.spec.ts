import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'

test.describe('@flow @feature:workspaces @readonly W03 — No-workspace redirects to picker', () => {
  test('Opening /scripts/add without a workspace lands on the picker', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/user/workspaces`)
    await page.evaluate(() => {
      try { localStorage.removeItem('workspace') } catch {}
      try { sessionStorage.removeItem('workspace') } catch {}
    })

    await page.goto(`${FRONTEND_URL}/scripts/add`)
    await page.waitForURL(/\/user\/workspaces\?rd=/, { timeout: 30_000 })
    expect(page.url()).toMatch(/\/user\/workspaces\?rd=[^&]*scripts/)
    await expect(page.getByRole('heading', { name: 'Select a workspace' })).toBeVisible()
  })
})
