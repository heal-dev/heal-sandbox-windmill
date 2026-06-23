import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import {
  deleteWorkspaceViaApi,
  loginAdmin,
  nsToWorkspaceId,
  deleteAcmeWorkspaces,
} from '../../helpers/workspaceApi'

test.describe('@flow @feature:workspaces @worker W01 — Create a new workspace', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ request }) => {
    const auth = await loginAdmin(request)
    await deleteAcmeWorkspaces(request, auth)
  })

  test('Create a workspace with a valid name and slug ID', async ({ page, request, fx }) => {
    const wsId = nsToWorkspaceId(`${fx.ns}-w01`)
    const auth = await loginAdmin(request)

    try {
      await page.goto(`${FRONTEND_URL}/user/workspaces`)
      await expect(page.getByRole('heading', { name: 'Select a workspace' })).toBeVisible()

      await page.getByRole('link', { name: /\+\s*Create a new workspace/ }).click()
      await expect(page).toHaveURL(/\/user\/create_workspace$/)
      await expect(page.getByRole('heading', { name: 'New Workspace' })).toBeVisible()

      await page.getByLabel(/Workspace name/i).fill('Acme')
      const idField = page.getByLabel(/Workspace ID/i)
      await idField.fill('')
      await idField.fill(wsId)

      await page.getByRole('button', { name: /^Create workspace$/ }).click()
      await page.waitForURL(/\/(?:$|\?)/, { timeout: 60_000 })
      await expect(page.getByRole('heading', { name: /^Home$/ })).toBeVisible({ timeout: 30_000 })
      // The workspace selector button is in the sidebar; its accessible text
      // includes the active workspace id.
      await expect(page.getByRole('button', { name: new RegExp(wsId, 'i') }).first()).toBeVisible({
        timeout: 15_000,
      })
    } finally {
      await deleteWorkspaceViaApi(request, auth, wsId)
    }
  })
})
