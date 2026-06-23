import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { deleteVariable } from '../../helpers/varResApi'

test.describe('@flow @feature:variables-and-resources @worker VR01 — Create variable', () => {
  test('Create a plaintext variable and the value appears in the list', async ({
    page,
    request,
    fx,
  }) => {
    const name = `vr01-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30)
    const path = `u/admin/${name}`
    const value = 'hello-vr01'
    const auth = await loginAdmin(request)

    try {
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/variables`)
      await expect(page.getByRole('heading', { name: 'Variables' })).toBeVisible({ timeout: 30_000 })

      await page.getByRole('button', { name: /^New variable$/ }).first().click()

      // The Path field is a suffix-only input (prefix 'u/admin/' is fixed in
      // the editor). Placeholder is 'variable'. Fill with just the slug.
      await page.getByPlaceholder('variable').first().fill(name)
      await page.getByPlaceholder(/Update variable value/i).first().fill(value)

      // Secret is a checkbox, not a switch — leave it unchecked (default).
      await page
        .getByRole('button', { name: /^Save$/ })
        .last()
        .click()

      // Row should appear in the table.
      const row = page
        .getByRole('row', { name: new RegExp(path) })
        .first()
        .or(page.locator('tr', { hasText: path }).first())
      await expect(row).toBeVisible({ timeout: 20_000 })
      await expect(row.getByText(value, { exact: false })).toBeVisible({ timeout: 10_000 })
    } finally {
      await deleteVariable(request, auth, path).catch(() => {})
    }
  })
})
