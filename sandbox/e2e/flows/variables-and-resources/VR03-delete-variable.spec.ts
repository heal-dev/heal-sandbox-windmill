import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createVariable, deleteVariable } from '../../helpers/varResApi'

test.describe('@flow @feature:variables-and-resources @worker VR03 — Delete variable', () => {
  test('Owner deletes a variable and the row disappears', async ({ page, request, fx }) => {
    const path = `u/admin/vr03-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_/-]/g, '-')
    const auth = await loginAdmin(request)
    await createVariable(request, auth, path, 'to-be-deleted')

    try {
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      page.on('dialog', (d) => d.accept().catch(() => {}))
      await page.goto(`${FRONTEND_URL}/variables`)
      await expect(page.getByRole('heading', { name: 'Variables' })).toBeVisible({ timeout: 30_000 })

      // The row is visible.
      const row = page.locator('tr', { hasText: path }).first()
      await expect(row).toBeVisible({ timeout: 20_000 })

      // Open the action menu — typically a kebab/dropdown trigger on the row.
      const menu = row.getByRole('button', { name: /menu|more|⋮|⋯/i }).first()
      if (await menu.count()) await menu.click()
      else await row.locator('button').last().click()

      await page
        .getByRole('menuitem', { name: /^Delete$/i })
        .first()
        .or(page.getByRole('button', { name: /^Delete$/i }).first())
        .click()

      await expect(page.locator('tr', { hasText: path })).toHaveCount(0, { timeout: 20_000 })
    } finally {
      await deleteVariable(request, auth, path).catch(() => {})
    }
  })
})
