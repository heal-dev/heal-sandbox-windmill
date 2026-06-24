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

test.describe('@flow @feature:raw-apps @worker RA01 — Create a raw app via API', () => {
  test('POST /apps/create_raw persists the row and /apps_raw/get/<path> mounts the viewer', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `ra01-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const appPath = `u/admin/${slug}`
    const summary = `RA01 ${slug}`

    try {
      await tryDeleteRawAppViaApi(request, auth, appPath)
      // Create through the multipart raw-app endpoint. The builder editor
      // (apps_raw/edit/<path>, RawAppEditor.svelte) is a Monaco-backed
      // multi-file IDE with hundreds of selectors; the brief's API-precondition
      // + UI-assertion split applies the same way as low-code apps (A01).
      const value = minimalRawAppValue(slug)
      const returnedPath = await createRawAppViaApi(request, auth, {
        path: appPath,
        summary,
        value,
        js: value.files['index.js'].code,
      })
      expect(returnedPath).toBe(appPath)

      // The deployed row carries raw_app=true, the posted summary, and the
      // slug-stamped HTML — round-tripping the bundle bytes is what the API
      // alone can prove without driving the iframe.
      const got = await getRawAppViaApi(request, auth, appPath)
      expect(got.ok).toBe(true)
      expect(got.body?.raw_app).toBe(true)
      expect(got.body?.summary).toBe(summary)
      expect(got.body?.path).toBe(appPath)
      expect(got.body?.value?.files?.['index.html']?.code).toContain(`hello-${slug}`)

      // UI assertion: navigate to /apps_raw/get/<path>. The raw-app viewer
      // (apps_raw/get/[...path]/+page.svelte) wraps the same InWorkspaceAppViewer
      // used for low-code apps; +page.js sets stuff.title = `App <path>`, so the
      // on-origin observable signal is the document <title>.
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
