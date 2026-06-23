import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createResource,
  deleteResource,
  deleteResourceType,
  ensureSimpleResourceType,
} from '../../helpers/varResApi'

test.describe('@flow @feature:variables-and-resources @worker VR05 — Delete resource', () => {
  test('Owner deletes a resource and the row disappears', async ({ page, request, fx }) => {
    const rtName = `vr05rt${fx.ns}`.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 28)
    const path = `u/admin/vr05-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_/-]/g, '-')
    const auth = await loginAdmin(request)
    await ensureSimpleResourceType(request, auth, rtName)
    await createResource(request, auth, path, rtName, { host: 'db.example.com' })

    try {
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      page.on('dialog', (d) => d.accept().catch(() => {}))
      await page.goto(`${FRONTEND_URL}/resources`)
      await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible({ timeout: 30_000 })

      const row = page.locator('tr', { hasText: path }).first()
      await expect(row).toBeVisible({ timeout: 20_000 })

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
      await deleteResource(request, auth, path).catch(() => {})
      await deleteResourceType(request, auth, rtName).catch(() => {})
    }
  })
})
