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

test.describe('@flow @feature:users-and-permissions @worker UP01 — Add a new user', () => {
  test.describe.configure({ mode: 'serial' })
  test.beforeAll(async ({ request }) => {
    const auth = await loginAdmin(request)
    await deleteAcmeWorkspaces(request, auth)
  })


  test('Admin adds an Operator-role user and a row appears', async ({ page, request, fx }) => {
    const wsId = nsToWorkspaceId(`${fx.ns}-up01`)
    const newEmail = `op-${fx.ns}@example.com`.toLowerCase()
    const auth = await loginAdmin(request)
    await createWorkspaceViaApi(request, auth, wsId, 'Acme')

    try {
      await selectWorkspaceForPage(page, wsId)
      await page.goto(`${FRONTEND_URL}/workspace_settings?tab=users`)
      await expect(
        page.getByRole('heading', { name: new RegExp(`^Workspace settings: ${wsId}$`) }),
      ).toBeVisible({ timeout: 30_000 })

      await page.getByRole('button', { name: /^Add new user$/ }).first().click()

      const emailField = page
        .getByPlaceholder(/email/i)
        .first()
        .or(page.getByLabel(/email/i).first())
      await emailField.fill(newEmail)

      // Pick Operator if a role chooser appears.
      const op = page.getByRole('radio', { name: /^Operator$/i }).first()
      if (await op.count()) await op.check({ force: true }).catch(() => {})
      else await page.getByText(/^Operator$/).first().click().catch(() => {})

      await page
        .getByRole('button', { name: /^(Add user|Add new user|Invite|Add)$/ })
        .last()
        .click()

      await expect(page.getByText(newEmail, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      })
    } finally {
      await deleteWorkspaceViaApi(request, auth, wsId).catch(() => {})
    }
  })
})
