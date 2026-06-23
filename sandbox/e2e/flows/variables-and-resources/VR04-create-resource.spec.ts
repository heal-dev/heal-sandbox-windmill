import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  deleteResource,
  deleteResourceType,
  ensureSimpleResourceType,
} from '../../helpers/varResApi'

test.describe('@flow @feature:variables-and-resources @worker VR04 — Create resource', () => {
  test('Developer creates a typed resource and the row appears', async ({
    page,
    request,
    fx,
  }) => {
    const rtName = `vr04rt${fx.ns}`.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 28)
    const path = `u/admin/vr04-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_/-]/g, '-')
    const auth = await loginAdmin(request)
    await ensureSimpleResourceType(request, auth, rtName)

    try {
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/resources`)
      await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible({ timeout: 30_000 })

      await page.getByRole('button', { name: /^Add resource$/ }).first().click()

      // Pick the resource type — usually a combobox / search field.
      const typeCombo = page
        .getByRole('combobox', { name: /resource type|type/i })
        .first()
        .or(page.getByPlaceholder(/resource type|type/i).first())
      await typeCombo.click().catch(() => {})
      await typeCombo.fill(rtName).catch(() => {})
      await page.getByText(rtName, { exact: false }).first().click()

      // Fill path.
      const pathField = page
        .getByLabel(/^Path$/i)
        .first()
        .or(page.getByPlaceholder(/^path|u\//i).first())
      await pathField.fill(path)

      // Fill the schema field `host`.
      const hostField = page
        .getByLabel(/^host$/i)
        .first()
        .or(page.getByPlaceholder(/^host$/i).first())
      await hostField.fill('db.example.com')

      await page
        .getByRole('button', { name: /^(Save|Create|Add|Confirm)$/i })
        .last()
        .click()

      const row = page.locator('tr', { hasText: path }).first()
      await expect(row).toBeVisible({ timeout: 20_000 })
    } finally {
      await deleteResource(request, auth, path).catch(() => {})
      await deleteResourceType(request, auth, rtName).catch(() => {})
    }
  })
})
