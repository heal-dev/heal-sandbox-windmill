import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import {
  createWorkspaceViaApi,
  deleteWorkspaceViaApi,
  loginAdmin,
  nsToWorkspaceId,
  selectWorkspaceForPage,
} from '../../helpers/workspaceApi'

test.describe('@flow @feature:workspaces @worker W04 — Edit workspace name', () => {
  test.describe.configure({ mode: 'serial' })

  test('Admin renames the workspace and the new name is visible', async ({ page, request, fx }) => {
    const wsId = nsToWorkspaceId(`${fx.ns}-w04`)
    const auth = await loginAdmin(request)
    await createWorkspaceViaApi(request, auth, wsId, 'Acme')

    try {
      await selectWorkspaceForPage(page, wsId)
      await page.goto(`${FRONTEND_URL}/workspace_settings?tab=general`)

      await expect(
        page.getByRole('heading', { name: new RegExp(`^Workspace settings: ${wsId}$`) }),
      ).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('heading', { name: /^General$/, level: 2 })).toBeVisible()

      const nameField = page.getByLabel(/^Workspace name$/i).first()
      await nameField.click()
      await page.keyboard.press('Control+A')
      await page.keyboard.press('Delete')
      await nameField.fill('Acme Renamed')

      // The General-tab save button is labelled "Save" near the Workspace name input.
      await page
        .getByRole('button', { name: /^Save$/ })
        .first()
        .click()

      // The UI shows a toast on success; assert a Saved/Success confirmation.
      await expect(
        page.getByText(/Workspace name updated|Saved|Success/i).first(),
      ).toBeVisible({ timeout: 15_000 })

      // Reload the settings page — the field should still hold "Acme Renamed".
      await page.goto(`${FRONTEND_URL}/workspace_settings?tab=general`)
      await expect(page.getByLabel(/^Workspace name$/i).first()).toHaveValue('Acme Renamed', {
        timeout: 15_000,
      })
    } finally {
      await deleteWorkspaceViaApi(request, auth, wsId)
    }
  })
})
