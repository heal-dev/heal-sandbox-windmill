import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createRawAppViaApi,
  deleteRawAppViaApi,
  getRawAppViaApi,
  minimalRawAppValue,
  tryDeleteRawAppViaApi,
  updateRawAppViaApi,
} from '../../helpers/rawAppsApi'

test.describe('@flow @feature:raw-apps @worker RA02 — Update raw app bundle via API', () => {
  test('POST /apps/update_raw/<path> replaces the bundle bytes and bumps the version', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `ra02-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const appPath = `u/admin/${slug}`
    const summaryV1 = `RA02 ${slug} v1`
    const summaryV2 = `RA02 ${slug} v2`

    try {
      await tryDeleteRawAppViaApi(request, auth, appPath)
      const valueV1 = minimalRawAppValue(slug, `<h1>hello-${slug}-v1</h1>`)
      await createRawAppViaApi(request, auth, {
        path: appPath,
        summary: summaryV1,
        value: valueV1,
        js: `console.log('v1-${slug}')`,
      })

      const before = await getRawAppViaApi(request, auth, appPath)
      expect(before.ok).toBe(true)
      expect(before.body?.raw_app).toBe(true)
      expect(before.body?.summary).toBe(summaryV1)
      const versionsV1: number[] = before.body?.versions ?? []
      expect(versionsV1.length).toBeGreaterThanOrEqual(1)

      // For raw-app updates `value` MUST be supplied: update_app_internal only
      // INSERTs a new app_version row when ns.value is Some(_); without it the
      // multipart handler re-uploads the JS bundle against the prior version id
      // and trips the app_bundles_pkey unique constraint. Mirrors the content-
      // hash gotcha called out in the brief.
      const valueV2 = minimalRawAppValue(slug, `<h1>hello-${slug}-v2</h1>`)
      await updateRawAppViaApi(request, auth, appPath, {
        summary: summaryV2,
        value: valueV2,
        js: `console.log('v2-${slug}')`,
        deployment_message: 'RA02 bundle update',
      })

      const after = await getRawAppViaApi(request, auth, appPath)
      expect(after.ok).toBe(true)
      expect(after.body?.summary).toBe(summaryV2)
      expect(after.body?.value?.files?.['index.html']?.code).toContain(`hello-${slug}-v2`)
      const versionsV2: number[] = after.body?.versions ?? []
      expect(versionsV2.length).toBeGreaterThan(versionsV1.length)

      // UI assertion: the viewer page still mounts at the same path.
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/apps_raw/get/${appPath}`)
      await expect(page).toHaveTitle(new RegExp(`App\\s+u/admin/${slug}`, 'i'), {
        timeout: 30_000,
      })
    } finally {
      await deleteRawAppViaApi(request, auth, appPath).catch(() => {})
    }
  })
})
