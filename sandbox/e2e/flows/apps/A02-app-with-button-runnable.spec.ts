import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  buttonAppValue,
  createAppViaApi,
  deleteAppViaApi,
  getAppViaApi,
  tryDeleteAppViaApi,
} from '../../helpers/appsApi'

test.describe('@flow @feature:apps @worker A02 — App with a button-runnable', () => {
  test('App carrying a buttoncomponent + inline script persists the runnable and viewer mounts', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `a02-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const appPath = `u/admin/${slug}`
    const payload = `hello-${slug}`

    try {
      await tryDeleteAppViaApi(request, auth, appPath)
      await createAppViaApi(request, auth, {
        path: appPath,
        summary: `A02 ${slug}`,
        value: buttonAppValue(slug, payload),
      })

      // Re-fetch the app and verify the inline script content travelled through
      // the backend intact. This is the API-side proof that the button is wired
      // to a runnable; the click+result assertion would require driving the
      // sandboxed /app_embed iframe — explicitly forbidden by the brief and
      // marked as A02.S2 with skipReason in spec.json.
      const got = await getAppViaApi(request, auth, appPath)
      expect(got.ok).toBe(true)
      const inline =
        got.body?.value?.grid?.[0]?.data?.componentInput?.runnable?.inlineScript?.content ?? ''
      expect(inline).toContain(payload)
      expect(inline).toContain(`ns: ${slug}`)

      // UI assertion: viewer page mounts (document title set by load()).
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/apps/get/${appPath}`)
      // The +page.js load returns stuff.title = `App ${params.path}`, which
      // SvelteKit renders as `App u/admin/<slug> | Windmill`. The full path
      // (not just the leaf slug) is what lands in the title.
      await expect(page).toHaveTitle(new RegExp(`App\\s+u/admin/${slug}`, 'i'), {
        timeout: 30_000,
      })
    } finally {
      await deleteAppViaApi(request, auth, appPath).catch(() => {})
    }
  })
})
