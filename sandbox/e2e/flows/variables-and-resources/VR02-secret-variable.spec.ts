import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { deleteVariable } from '../../helpers/varResApi'

test.describe('@flow @feature:variables-and-resources @worker VR02 — Secret variable masking', () => {
  test('Secret variable value is not visible in the list', async ({ page, request, fx }) => {
    const path = `u/admin/vr02-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_/-]/g, '-')
    const value = `topsecret-${fx.ns}`
    const auth = await loginAdmin(request)

    try {
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/variables`)
      await expect(page.getByRole('heading', { name: 'Variables' })).toBeVisible({ timeout: 30_000 })

      await page.getByRole('button', { name: /^New variable$/ }).first().click()

      const pathField = page
        .getByLabel(/^Path$/i)
        .first()
        .or(page.getByPlaceholder(/path/i).first())
      await pathField.fill(path)

      const valueField = page
        .getByLabel(/^Value$/i)
        .first()
        .or(page.getByPlaceholder(/value/i).first())
      await valueField.fill(value)

      // Turn Secret ON.
      const secretSwitch = page.getByRole('switch', { name: /secret/i }).first()
      if (await secretSwitch.count()) {
        const checked = await secretSwitch.getAttribute('aria-checked').catch(() => null)
        if (checked !== 'true') await secretSwitch.click()
      }

      await page
        .getByRole('button', { name: /^(Save|Create|Add|Confirm)$/i })
        .last()
        .click()

      // Row appears.
      const row = page
        .getByRole('row', { name: new RegExp(path) })
        .first()
        .or(page.locator('tr', { hasText: path }).first())
      await expect(row).toBeVisible({ timeout: 20_000 })

      // The literal secret value must NOT be rendered anywhere on the page (the
      // list endpoint returns value:null for is_secret=true).
      await expect(page.getByText(value, { exact: false })).toHaveCount(0)
    } finally {
      await deleteVariable(request, auth, path).catch(() => {})
    }
  })
})
