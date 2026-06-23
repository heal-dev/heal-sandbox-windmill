import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import {
  createWorkspaceViaApi,
  deleteWorkspaceViaApi,
  loginAdmin,
  nsToWorkspaceId,
  selectWorkspaceForPage,
} from '../../helpers/workspaceApi'

test.describe('@flow @feature:workspaces @worker W06 — Leave a workspace', () => {
  test.describe.configure({ mode: 'serial' })

  test('Leaving the workspace returns me to the picker and removes it', async ({
    page,
    request,
    fx,
  }) => {
    const wsId = nsToWorkspaceId(`${fx.ns}-w06`)
    const auth = await loginAdmin(request)
    await createWorkspaceViaApi(request, auth, wsId, 'Acme')

    try {
      await selectWorkspaceForPage(page, wsId)
      await page.goto(`${FRONTEND_URL}/workspace_settings`)

      await expect(
        page.getByRole('heading', { name: new RegExp(`^Workspace settings: ${wsId}$`) }),
      ).toBeVisible({ timeout: 30_000 })

      const leaveBtn = page.getByRole('button', { name: /Leave workspace/i }).first()
      await leaveBtn.click()
      // A confirm modal opens; click its primary destructive button.
      const confirmBtn = page
        .getByRole('button', { name: /^(Leave|Yes, leave|Confirm)/i })
        .last()
      await confirmBtn.click()

      await page.waitForURL(/\/user\/workspaces/, { timeout: 30_000 })
      await expect(page.getByRole('heading', { name: 'Select a workspace' })).toBeVisible()
      // The left workspace must NOT appear in the Workspaces section anymore.
      await expect(page.getByRole('button', { name: new RegExp(wsId) })).toHaveCount(0)
    } finally {
      // If the test failed mid-flight, the workspace may still exist — clean up best-effort.
      await deleteWorkspaceViaApi(request, auth, wsId).catch(() => {})
    }
  })
})
