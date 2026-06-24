import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createAppViaApi,
  deleteAppViaApi,
  getAppViaApi,
  tryDeleteAppViaApi,
  minimalAppValue,
} from '../../helpers/appsApi'

test.describe('@flow @feature:apps @worker A01 — Create a minimal app via API', () => {
  test('POST /apps/create persists the row and /apps/get/<path> mounts the viewer', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `a01-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const appPath = `u/admin/${slug}`
    const summary = `A01 ${slug}`

    try {
      await tryDeleteAppViaApi(request, auth, appPath)
      // Create through the backend — the builder UI is prohibitively brittle
      // to drive end-to-end (drag-drop with hundreds of selectors), so the
      // brief's API-precondition + UI-assertion split is used here.
      const returnedPath = await createAppViaApi(request, auth, {
        path: appPath,
        summary,
        value: minimalAppValue(slug),
      })
      expect(returnedPath).toBe(appPath)

      // The deployed row is fetchable via the read endpoint and carries the
      // posted summary.
      const got = await getAppViaApi(request, auth, appPath)
      expect(got.ok).toBe(true)
      expect(got.body?.summary).toBe(summary)
      expect(got.body?.path).toBe(appPath)

      // UI assertion: navigate to /apps/get/<path>. The InWorkspaceAppViewer's
      // own markup runs inside an opaque /app_embed iframe (PublicAppFrame's
      // sandbox-isolation path), so the on-origin observable signal is the
      // SvelteKit-rendered document <title> which apps/get/[...path]/+page.js
      // sets to `App <path>`.
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/apps/get/${appPath}`)
      // The title is set via the page load function's `stuff.title` and ends
      // up as `App <path> | Windmill`. The path embeds slashes (u/admin/<slug>),
      // so we match against the slug suffix.
      await expect(page).toHaveTitle(new RegExp(`App\\s+u/admin/${slug}`, 'i'), {
        timeout: 30_000,
      })
    } finally {
      await deleteAppViaApi(request, auth, appPath).catch(() => {})
    }
  })
})
