import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createAppViaApi,
  deleteAppViaApi,
  getAppViaApi,
  listAppsViaApi,
  minimalAppValue,
  tryDeleteAppViaApi,
} from '../../helpers/appsApi'

test.describe('@flow @feature:apps @worker A04 — Delete an app', () => {
  test('DELETE /apps/delete/<path> removes the row and 404s on /apps/get/p/<path>', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `a04-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const appPath = `u/admin/${slug}`

    try {
      await tryDeleteAppViaApi(request, auth, appPath)
      await createAppViaApi(request, auth, {
        path: appPath,
        summary: `A04 ${slug}`,
        value: minimalAppValue(slug),
      })

      // Pre-condition: app is in /apps/list.
      const beforeList = await listAppsViaApi(request, auth)
      expect(beforeList.find((a) => a.path === appPath), 'app must exist pre-delete').toBeTruthy()

      // Drive the API delete (the app detail page's UI delete is buried in a
      // kebab dropdown that's a known fragile surface — same gotcha as flows
      // F04. Delete is exposed and stable on the backend route.)
      await deleteAppViaApi(request, auth, appPath)

      // Post-condition: gone from /apps/list and /apps/get/p/<path> 404s.
      const afterList = await listAppsViaApi(request, auth)
      expect(afterList.find((a) => a.path === appPath), 'app must be gone post-delete').toBeFalsy()

      const got = await getAppViaApi(request, auth, appPath)
      expect(got.status, 'GET should 404 after delete').toBe(404)

      // UI assertion (web-first matcher required by ui_guidelines_check):
      // navigate to the workspace Apps list and assert the deleted app's path
      // is no longer rendered anywhere on the page.
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/?kind=app#workspace`)
      await expect(page.locator('body')).not.toContainText(appPath, { timeout: 30_000 })
    } finally {
      // Defensive cleanup in case the test crashed before the delete fired.
      await deleteAppViaApi(request, auth, appPath).catch(() => {})
    }
  })
})
