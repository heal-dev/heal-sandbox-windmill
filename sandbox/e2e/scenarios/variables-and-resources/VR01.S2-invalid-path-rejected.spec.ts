import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'

test.describe('@scenario @feature:variables-and-resources @invariant @readonly VR01.S2 — Invalid path', () => {
  test('Invalid path blocks submission of the create-variable form', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
    await page.goto(`${FRONTEND_URL}/variables`)
    await expect(page.getByRole('heading', { name: 'Variables' })).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: /^New variable$/ }).first().click()

    const pathField = page
      .getByLabel(/^Path$/i)
      .first()
      .or(page.getByPlaceholder(/path/i).first())
    await pathField.fill('tmp/whatever')

    // Submit button must be disabled (or a visible validation message appears).
    const submit = page.getByRole('button', { name: /^(Save|Create|Add|Confirm)$/i }).last()
    await expect(submit).toBeDisabled({ timeout: 5_000 })
  })
})
