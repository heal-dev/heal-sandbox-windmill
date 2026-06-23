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
import { createGroup } from '../../helpers/userApi'

test.describe('@flow @feature:users-and-permissions @worker UP06 — Delete a group', () => {
  test.describe.configure({ mode: 'serial' })
  test.beforeAll(async ({ request }) => {
    const auth = await loginAdmin(request)
    await deleteAcmeWorkspaces(request, auth)
  })


  test('Admin deletes a group and its row disappears', async ({ page, request, fx }) => {
    const wsId = nsToWorkspaceId(`${fx.ns}-up06`)
    const groupName = `del-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40)
    const auth = await loginAdmin(request)
    await createWorkspaceViaApi(request, auth, wsId, 'Acme')
    await createGroup(request, auth, wsId, groupName)

    try {
      await selectWorkspaceForPage(page, wsId)
      await page.goto(`${FRONTEND_URL}/groups`)
      await expect(page.getByRole('heading', { name: 'Groups' })).toBeVisible({ timeout: 30_000 })

      const row = page.locator(`tr, [role="row"]`).filter({ hasText: groupName }).first()
      await expect(row).toBeVisible({ timeout: 15_000 })

      // Open the dropdown / kebab menu on the row.
      const kebab = row.getByRole('button', { name: /menu|more|⋮|⋯/i }).first()
      if (await kebab.count()) await kebab.click()
      else
        await row
          .locator('button')
          .filter({ hasNot: row.locator('text=' + groupName) })
          .last()
          .click()

      // Confirm dialog or accept native confirm.
      page.on('dialog', (d) => d.accept().catch(() => {}))
      await page
        .getByRole('menuitem', { name: /^Delete$/ })
        .first()
        .or(page.getByRole('button', { name: /^Delete$/ }).first())
        .click()

      // The destructive action removes the row.
      await expect(row).toHaveCount(0, { timeout: 15_000 })
    } finally {
      await deleteWorkspaceViaApi(request, auth, wsId).catch(() => {})
    }
  })
})
