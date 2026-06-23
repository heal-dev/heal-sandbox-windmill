import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { deleteResourceType } from '../../helpers/varResApi'

test.describe('@flow @feature:variables-and-resources @worker VR06 — Create resource type', () => {
  test('Admin creates a resource type and it appears in the list', async ({
    page,
    request,
    fx,
  }) => {
    const rtName = `vr06rt${fx.ns}`.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 28)
    const auth = await loginAdmin(request)

    try {
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/resources`)
      await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible({ timeout: 30_000 })

      // Switch to the "Resource Types" tab.
      await page.getByRole('button', { name: /^Resource Types$/ }).first().click()

      await page.getByRole('button', { name: /^Add resource type$/ }).first().click()

      // The create dialog: name + schema editor. Fill name first.
      const nameField = page
        .getByLabel(/^Name$/i)
        .first()
        .or(page.getByPlaceholder(/^name$|^my_type/i).first())
      await nameField.fill(rtName)

      // The schema editor is typically a JSON / Monaco editor. Fill via aria-textbox if accessible.
      const editor = page.getByRole('textbox', { name: /editor|schema/i }).first()
      if (await editor.count()) {
        await editor.click()
        await page.keyboard.press('Control+A')
        await page.keyboard.press('Delete')
        await page.keyboard.type('{"type":"object","properties":{"host":{"type":"string"}},"required":["host"]}')
      }

      await page
        .getByRole('button', { name: /^(Save|Create|Add|Confirm)$/i })
        .last()
        .click()

      // The new type appears in the Resource Types table.
      await expect(page.getByText(rtName, { exact: false }).first()).toBeVisible({
        timeout: 20_000,
      })
    } finally {
      await deleteResourceType(request, auth, rtName).catch(() => {})
    }
  })
})
