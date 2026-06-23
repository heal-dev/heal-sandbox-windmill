import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, SEED } from '../../../config'
import {
  createWorkspaceViaApi,
  deleteWorkspaceViaApi,
  loginAdmin,
  nsToWorkspaceId,
  selectWorkspaceForPage,

  deleteAcmeWorkspaces,
} from '../../helpers/workspaceApi'

test.describe('@flow @feature:users-and-permissions @worker UP03 — Self-demotion blocked', () => {
  test.describe.configure({ mode: 'serial' })
  test.beforeAll(async ({ request }) => {
    const auth = await loginAdmin(request)
    await deleteAcmeWorkspaces(request, auth)
  })


  test('My own row stays at Admin even after clicking Operator', async ({ page, request, fx }) => {
    const wsId = nsToWorkspaceId(`${fx.ns}-up03`)
    const auth = await loginAdmin(request)
    await createWorkspaceViaApi(request, auth, wsId, 'Acme')

    try {
      await selectWorkspaceForPage(page, wsId)
      await page.goto(`${FRONTEND_URL}/workspace_settings?tab=users`)
      await expect(
        page.getByRole('heading', { name: new RegExp(`^Workspace settings: ${wsId}$`) }),
      ).toBeVisible({ timeout: 30_000 })

      const myRow = page.getByRole('row', { name: new RegExp(SEED.admin.email) }).first()
      await expect(myRow).toBeVisible({ timeout: 15_000 })

      // The Admin chip should be the active selection on my row.
      await expect(
        myRow.locator('[aria-pressed="true"], .selected, .active').filter({ hasText: /^Admin$/ }),
      ).toBeVisible({ timeout: 10_000 })

      // Attempt to click Operator on my own row — Windmill should either disable
      // the chip or refuse the change.
      const opChip = myRow.getByRole('button', { name: /^Operator$/ })
      page.on('dialog', (d) => d.dismiss().catch(() => {})) // any blocking confirm — dismiss it
      await opChip.click().catch(() => {})

      // After the attempt, the active chip on my row is STILL "Admin".
      await expect(
        myRow.locator('[aria-pressed="true"], .selected, .active').filter({ hasText: /^Admin$/ }),
      ).toBeVisible({ timeout: 5_000 })
    } finally {
      await deleteWorkspaceViaApi(request, auth, wsId).catch(() => {})
    }
  })
})
