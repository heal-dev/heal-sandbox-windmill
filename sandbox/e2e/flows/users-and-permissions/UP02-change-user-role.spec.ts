import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import {
  createWorkspaceViaApi,
  deleteWorkspaceViaApi,
  loginAdmin,
  nsToWorkspaceId,
  selectWorkspaceForPage,

  deleteAcmeWorkspaces,
} from '../../helpers/workspaceApi'
import { addUserToWorkspace, createInstanceUser } from '../../helpers/userApi'

test.describe('@flow @feature:users-and-permissions @worker UP02 — Change user role', () => {
  test.describe.configure({ mode: 'serial' })
  test.beforeAll(async ({ request }) => {
    const auth = await loginAdmin(request)
    await deleteAcmeWorkspaces(request, auth)
  })


  test('Admin promotes Operator to Developer via the role chip', async ({ page, request, fx }) => {
    const wsId = nsToWorkspaceId(`${fx.ns}-up02`)
    const memberEmail = `up02-${fx.ns}@example.com`.toLowerCase()
    const auth = await loginAdmin(request)
    await createWorkspaceViaApi(request, auth, wsId, 'Acme')
    await createInstanceUser(request, auth, memberEmail)
    await addUserToWorkspace(request, auth, wsId, memberEmail, 'operator')

    try {
      await selectWorkspaceForPage(page, wsId)
      await page.goto(`${FRONTEND_URL}/workspace_settings?tab=users`)
      await expect(
        page.getByRole('heading', { name: new RegExp(`^Workspace settings: ${wsId}$`) }),
      ).toBeVisible({ timeout: 30_000 })
      // Member row visible
      const row = page.getByRole('row', { name: new RegExp(memberEmail) }).first()
      await expect(row).toBeVisible({ timeout: 15_000 })

      // Click the Developer chip on that row
      await row.getByRole('button', { name: /^Developer$/ }).click()

      // The Developer chip becomes the active selection on the row — Windmill
      // marks the active chip with aria-pressed=true or a "selected" class. Verify
      // by re-querying and asserting the chip has the active state.
      await expect(
        row.locator('[aria-pressed="true"], .selected, .active').filter({ hasText: /^Developer$/ }),
      ).toBeVisible({ timeout: 15_000 })
    } finally {
      await deleteWorkspaceViaApi(request, auth, wsId).catch(() => {})
    }
  })
})
