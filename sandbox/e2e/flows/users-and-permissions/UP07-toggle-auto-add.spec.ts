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

test.describe('@flow @feature:users-and-permissions @worker UP07 — Toggle auto-add', () => {
  test.describe.configure({ mode: 'serial' })
  test.beforeAll(async ({ request }) => {
    const auth = await loginAdmin(request)
    await deleteAcmeWorkspaces(request, auth)
  })


  test('Enabling auto-add flips the toggle button to ON', async ({ page, request, fx }) => {
    const wsId = nsToWorkspaceId(`${fx.ns}-up07`)
    const auth = await loginAdmin(request)
    await createWorkspaceViaApi(request, auth, wsId, 'Acme')

    try {
      await selectWorkspaceForPage(page, wsId)
      await page.goto(`${FRONTEND_URL}/workspace_settings?tab=users`)
      await expect(
        page.getByRole('heading', { name: new RegExp(`^Workspace settings: ${wsId}$`) }),
      ).toBeVisible({ timeout: 30_000 })

      // The toggle button reads "Auto-{invite,add}: OFF" (cloud vs on-prem).
      const offBtn = page
        .getByRole('button', { name: /^Auto-(invite|add): OFF$/ })
        .first()
      await expect(offBtn).toBeVisible({ timeout: 15_000 })
      await offBtn.click()

      // Enable master toggle in the popover.
      const master = page
        .getByRole('switch')
        .or(page.getByRole('checkbox'))
        .first()
      await master.click({ force: true }).catch(() => {})

      // Pick Operator as the default role if a chooser is shown.
      const op = page.getByRole('radio', { name: /^Operator$/i }).first()
      if (await op.count()) await op.check({ force: true }).catch(() => {})

      // Close popover by clicking outside or hitting Escape.
      await page.keyboard.press('Escape')

      // The toggle now reads ON.
      await expect(
        page.getByRole('button', { name: /^Auto-(invite|add): ON$/ }).first(),
      ).toBeVisible({ timeout: 15_000 })
    } finally {
      await deleteWorkspaceViaApi(request, auth, wsId).catch(() => {})
    }
  })
})
