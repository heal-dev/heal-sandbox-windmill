import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import {
  createWorkspaceViaApi,
  deleteWorkspaceViaApi,
  loginAdmin,
  nsToWorkspaceId,
  selectWorkspaceForPage,
} from '../../helpers/workspaceApi'

test.describe('@flow @feature:workspaces @worker W05 — Invite a user', () => {
  test.describe.configure({ mode: 'serial' })

  test('Admin sends an invite and a pending row appears', async ({ page, request, fx }) => {
    const wsId = nsToWorkspaceId(`${fx.ns}-w05`)
    const inviteeEmail = `invitee-${fx.ns}@example.com`.toLowerCase()
    const auth = await loginAdmin(request)
    await createWorkspaceViaApi(request, auth, wsId, 'Acme')

    try {
      await selectWorkspaceForPage(page, wsId)
      await page.goto(`${FRONTEND_URL}/workspace_settings?tab=users`)

      await expect(
        page.getByRole('heading', { name: new RegExp(`^Workspace settings: ${wsId}$`) }),
      ).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('heading', { name: /^Members \(/, level: 2 })).toBeVisible({
        timeout: 15_000,
      })

      // The Users tab CTA is "Add new user", which opens a modal/drawer with
      // email + role + send-invite vs add-immediately options.
      await page
        .getByRole('button', { name: /^Add new user$/ })
        .first()
        .click()

      const emailField = page
        .getByPlaceholder(/email/i)
        .first()
        .or(page.getByLabel(/email/i).first())
      await emailField.fill(inviteeEmail)

      // Submit — the CTA is typically labelled "Add user" or "Invite".
      await page
        .getByRole('button', { name: /^(Add user|Invite|Add new user)$/i })
        .last()
        .click()

      // The new pending member row shows the invitee email in the page.
      await expect(page.getByText(inviteeEmail, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      })
    } finally {
      await deleteWorkspaceViaApi(request, auth, wsId)
    }
  })
})
