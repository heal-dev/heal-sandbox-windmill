import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createAppViaApi,
  deleteAppViaApi,
  getAppViaApi,
  minimalAppValue,
  tryDeleteAppViaApi,
  updateAppViaApi,
} from '../../helpers/appsApi'

test.describe('@flow @feature:apps @worker A03 — Edit app summary via API', () => {
  test('Updating summary via /apps/update/<path> persists the new value', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `a03-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const appPath = `u/admin/${slug}`
    const summaryV1 = `A03 ${slug} v1`
    const summaryV2 = `A03 ${slug} v2`

    try {
      await tryDeleteAppViaApi(request, auth, appPath)
      await createAppViaApi(request, auth, {
        path: appPath,
        summary: summaryV1,
        value: minimalAppValue(slug),
      })

      // Pre-condition: the deployed row carries the v1 summary.
      const before = await getAppViaApi(request, auth, appPath)
      expect(before.ok).toBe(true)
      expect(before.body?.summary).toBe(summaryV1)

      // Drive the API update — the editor's drag-drop builder is too brittle
      // to author by clicks (forbidden by the brief). The deploy path the
      // editor itself uses (utils_draft_deploy.ts) is the same endpoint.
      // Stamp v2 into the value's `description` so the JSON-encoded content
      // hash actually changes (matches the slug-injection gotcha called out
      // in the brief — avoids a no-op deploy that some deployers short-circuit).
      await updateAppViaApi(request, auth, appPath, {
        path: appPath,
        summary: summaryV2,
        value: { ...minimalAppValue(slug), description: `ns:${slug}:v2` },
        policy: { execution_mode: 'viewer' },
        deployment_message: 'A03 summary update',
      })

      // Post-condition: GET surfaces the v2 summary.
      const after = await getAppViaApi(request, auth, appPath)
      expect(after.ok).toBe(true)
      expect(after.body?.summary).toBe(summaryV2)

      // UI assertion: the viewer page still mounts at the same path.
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/apps/get/${appPath}`)
      // +page.js load returns stuff.title = `App ${params.path}` → title is
      // `App u/admin/<slug> | Windmill`.
      await expect(page).toHaveTitle(new RegExp(`App\\s+u/admin/${slug}`, 'i'), {
        timeout: 30_000,
      })
    } finally {
      await deleteAppViaApi(request, auth, appPath).catch(() => {})
    }
  })
})
