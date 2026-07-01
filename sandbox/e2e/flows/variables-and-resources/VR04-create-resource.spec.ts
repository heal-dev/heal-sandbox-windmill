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
      // Fill path. `<input id="path">` (Path.svelte:531) has no associated
      // <label for>; its placeholder defaults to the resource-type name, so
      // the only stable handle is the `#path` id.
      const pathField = page.locator('input#path').first()
      await pathField.fill(path)

      // Wait for the type-picker dropdown to close (it can overlay the
      // SchemaForm field for ~1s after selection) before the SchemaForm field
      // becomes interactable.
      await page.waitForTimeout(1500)

      // Fill the schema field `host`. SchemaForm → ArgInput → TextInput
      // renders a <textarea> with `use:autosize`; `pressSequentially` plays
      // well with autosize whereas `.fill()` can race on the stability check.
      const hostField = page.locator('textarea:not(#resource-description)').last()
      await hostField.focus()
      await hostField.pressSequentially('db.example.com')

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
