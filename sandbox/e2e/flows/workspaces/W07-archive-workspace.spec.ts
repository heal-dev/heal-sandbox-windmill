import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import {
  createWorkspaceViaApi,
  deleteWorkspaceViaApi,
  loginAdmin,
  nsToWorkspaceId,
  selectWorkspaceForPage,
} from '../../helpers/workspaceApi'

test.describe('@flow @feature:workspaces @worker W07 — Archive a workspace', () => {
  test.describe.configure({ mode: 'serial' })

  test('Archiving the workspace returns me to the picker', async ({ page, request, fx }) => {
    const wsId = nsToWorkspaceId(`${fx.ns}-w07`)
    const auth = await loginAdmin(request)
    await createWorkspaceViaApi(request, auth, wsId, 'Acme')

    try {
      await selectWorkspaceForPage(page, wsId)
      // Windmill renders "Archive workspace" inside the General tab, not Advanced.
      await page.goto(`${FRONTEND_URL}/workspace_settings?tab=general`)

      await expect(
        page.getByRole('heading', { name: new RegExp(`^Workspace settings: ${wsId}$`) }),
      ).toBeVisible({ timeout: 30_000 })

      // Archive uses a native confirm() dialog — accept it before clicking.
      page.on('dialog', (dialog) => dialog.accept().catch(() => {}))
      const archiveBtn = page.getByRole('button', { name: /^Archive workspace$/ }).first()
      await archiveBtn.click()

      await page.waitForURL(/\/user\/workspaces/, { timeout: 30_000 })
      await expect(page.getByRole('heading', { name: 'Select a workspace' })).toBeVisible()
    } finally {
      await deleteWorkspaceViaApi(request, auth, wsId).catch(() => {})
    }
  })
})
