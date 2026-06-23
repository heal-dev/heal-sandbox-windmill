import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import {
  createWorkspaceViaApi,
  deleteAcmeWorkspaces,
  deleteWorkspaceViaApi,
  loginAdmin,
  nsToWorkspaceId,
} from '../../helpers/workspaceApi'

test.describe('@scenario @feature:workspaces @invariant @worker W01.S3 — CE workspace cap', () => {
  test.describe.configure({ mode: 'serial' })

  test('Submitting a 3rd workspace shows the CE cap error', async ({ page, request, fx }) => {
    const a = nsToWorkspaceId(`${fx.ns}-cap-a`)
    const b = nsToWorkspaceId(`${fx.ns}-cap-b`)
    const c = nsToWorkspaceId(`${fx.ns}-cap-c`)
    const auth = await loginAdmin(request)

    // Precondition: the user already owns 2 non-admin workspaces (the cap).
    await deleteAcmeWorkspaces(request, auth)
    await createWorkspaceViaApi(request, auth, a, 'Acme')
    await createWorkspaceViaApi(request, auth, b, 'Acme')

    try {
      await page.goto(`${FRONTEND_URL}/user/create_workspace`)
      await expect(page.getByRole('heading', { name: 'New Workspace' })).toBeVisible()

      await page.getByLabel(/Workspace name/i).fill('Acme Third')
      const idField = page.getByLabel(/Workspace ID/i)
      await idField.fill('')
      await idField.fill(c)

      await page.getByRole('button', { name: /^Create workspace$/ }).click()

      // The UI surfaces backend errors as a toast/alert; assert the cap message
      // appears on screen and the URL did not advance to /.
      await expect(
        page.getByText(/maximum number of workspaces/i).first(),
      ).toBeVisible({ timeout: 15_000 })
      expect(page.url()).toMatch(/\/user\/create_workspace/)
    } finally {
      await deleteWorkspaceViaApi(request, auth, a).catch(() => {})
      await deleteWorkspaceViaApi(request, auth, b).catch(() => {})
      await deleteWorkspaceViaApi(request, auth, c).catch(() => {})
    }
  })
})
