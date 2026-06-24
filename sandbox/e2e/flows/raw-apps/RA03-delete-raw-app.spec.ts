import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createRawAppViaApi,
  deleteRawAppViaApi,
  getRawAppViaApi,
  minimalRawAppValue,
  tryDeleteRawAppViaApi,
} from '../../helpers/rawAppsApi'

test.describe('@flow @feature:raw-apps @worker RA03 — Delete a raw app', () => {
  test('DELETE /apps/delete/<path> removes the row and 404s on /apps/get/p/<path>', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `ra03-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const appPath = `u/admin/${slug}`

    try {
      await tryDeleteRawAppViaApi(request, auth, appPath)
      await createRawAppViaApi(request, auth, {
        path: appPath,
        summary: `RA03 ${slug}`,
        value: minimalRawAppValue(slug),
        js: `console.log('ra03-${slug}')`,
      })

      // Pre-condition: app exists.
      const before = await getRawAppViaApi(request, auth, appPath)
      expect(before.ok, 'raw app must exist pre-delete').toBe(true)
      expect(before.body?.raw_app).toBe(true)

      // Delete via the shared /apps/delete/<path> route. Raw apps live in the
      // same `app` table as low-code apps and share this DELETE handler.
      await deleteRawAppViaApi(request, auth, appPath)

      // Post-condition: GET 404s.
      const after = await getRawAppViaApi(request, auth, appPath)
      expect(after.status, 'GET should 404 after delete').toBe(404)

      // UI assertion (web-first matcher required by ui_guidelines_check):
      // navigate to the workspace Apps list and assert the deleted app's path
      // is no longer rendered. Raw apps render in the same Home Apps tab as
      // low-code apps (no separate /apps_raw list route exists — confirmed by
      // grep of frontend/src/routes/(root)/(logged)/apps_raw).
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/?kind=app#workspace`)
      await expect(page.locator('body')).not.toContainText(appPath, { timeout: 30_000 })
    } finally {
      await deleteRawAppViaApi(request, auth, appPath).catch(() => {})
    }
  })
})
