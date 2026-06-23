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
import { addUserToWorkspace, createGroup, createInstanceUser } from '../../helpers/userApi'

test.describe('@flow @feature:users-and-permissions @worker UP05 — Add member to group', () => {
  test.describe.configure({ mode: 'serial' })
  test.beforeAll(async ({ request }) => {
    const auth = await loginAdmin(request)
    await deleteAcmeWorkspaces(request, auth)
  })


  test('Admin adds an Operator member to a group', async ({ page, request, fx }) => {
    const wsId = nsToWorkspaceId(`${fx.ns}-up05`)
    const memberEmail = `up05-${fx.ns}@example.com`.toLowerCase()
    const groupName = `engs-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40)
    const auth = await loginAdmin(request)
    await createWorkspaceViaApi(request, auth, wsId, 'Acme')
    await createInstanceUser(request, auth, memberEmail)
    await addUserToWorkspace(request, auth, wsId, memberEmail, 'operator')
    await createGroup(request, auth, wsId, groupName)

    try {
      await selectWorkspaceForPage(page, wsId)
      await page.goto(`${FRONTEND_URL}/groups`)
      await expect(page.getByRole('heading', { name: 'Groups' })).toBeVisible({ timeout: 30_000 })

      // Open the group's editor — clicking the group name row should open the drawer.
      await page.getByText(groupName, { exact: false }).first().click()

      // In the drawer, locate the add-member affordance (often a "+" button or a
      // user picker labelled "Add user" / "Add member").
      const addMember = page
        .getByRole('button', { name: /^(Add member|Add user|Add)$/ })
        .first()
      await addMember.click().catch(async () => {
        // Some builds expose a combobox directly — try the user picker.
        const picker = page.getByPlaceholder(/user|email/i).first()
        await picker.click()
      })

      // Pick the member email from the chooser.
      await page.getByText(memberEmail, { exact: false }).first().click()
      // Optional confirm.
      await page
        .getByRole('button', { name: /^(Add|Confirm|Save)$/ })
        .last()
        .click()
        .catch(() => {})

      // Member email should now be visible in the group's member section.
      await expect(page.getByText(memberEmail, { exact: false }).first()).toBeVisible({
        timeout: 15_000,
      })
    } finally {
      await deleteWorkspaceViaApi(request, auth, wsId).catch(() => {})
    }
  })
})
