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

test.describe('@flow @feature:users-and-permissions @worker UP04 — Create a group', () => {
  test.describe.configure({ mode: 'serial' })
  test.beforeAll(async ({ request }) => {
    const auth = await loginAdmin(request)
    await deleteAcmeWorkspaces(request, auth)
  })


  test('Admin creates a workspace group and the row appears', async ({ page, request, fx }) => {
    const wsId = nsToWorkspaceId(`${fx.ns}-up04`)
    const groupName = `engineers-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40)
    const auth = await loginAdmin(request)
    await createWorkspaceViaApi(request, auth, wsId, 'Acme')

    try {
      await selectWorkspaceForPage(page, wsId)
      await page.goto(`${FRONTEND_URL}/groups`)
      await expect(page.getByRole('heading', { name: 'Groups' })).toBeVisible({ timeout: 30_000 })

      await page.getByRole('button', { name: /^New group$/ }).first().click()

      // The popover has a name input — fill and submit.
      const nameField = page
        .getByPlaceholder(/name/i)
        .first()
        .or(page.getByLabel(/name/i).first())
      await nameField.fill(groupName)

      // Submit — common labels are "Create" or "Add" or "Save".
      await page
        .getByRole('button', { name: /^(Create|Add|Save|Create group)$/i })
        .last()
        .click()

      await expect(page.getByText(groupName, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      })
    } finally {
      await deleteWorkspaceViaApi(request, auth, wsId).catch(() => {})
    }
  })
})
