import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, API_BASE, SEED } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'

const wid = SEED.workspace.id

test.describe('@flow @feature:triggers @worker T04 — Invoke deployed script via webhook URL', () => {
  test('POST run_wait_result returns the script value; row appears in /runs', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `t04-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`
    const expectedValue = `hello-${slug}`

    try {
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    # ns: ${slug}\n    return '${expectedValue}'\n`,
        summary: `T04 ${slug}`,
      })

      // The per-runnable webhook URL is exactly the route under jobs_u that
      // run_wait_result mounts: /api/w/<wid>/jobs/run_wait_result/p/<path>.
      // Same shape the WebhooksConfigSection generates client-side. The Bearer
      // header carries the admin token we already minted via loginAdmin (the
      // cookie value).
      const token = auth.cookie.replace(/^token=/, '')
      // run-by-path can 404 briefly after scripts/create — retry like
      // runScriptViaApi does.
      const deadline = Date.now() + 30_000
      let lastStatus = 0
      let lastBody = ''
      while (Date.now() < deadline) {
        const res = await request.post(
          `${API_BASE}/w/${wid}/jobs/run_wait_result/p/${scriptPath}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            data: {},
          },
        )
        lastStatus = res.status()
        lastBody = (await res.text()).trim()
        if (res.ok()) break
        if (lastStatus !== 404) break
        await new Promise((r) => setTimeout(r, 500))
      }
      expect(lastStatus, `webhook POST status (body=${lastBody.slice(0, 200)})`).toBe(200)
      // Body is JSON-encoded ("hello-..."); strip the surrounding quotes.
      expect(lastBody.replace(/^"|"$/g, '')).toBe(expectedValue)

      // UI assertion: navigate to /runs and find a row whose script_path
      // matches our slug.
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/runs`)
      await expect(page.getByRole('heading', { name: /^Runs$/i })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText(new RegExp(slug, 'i')).first()).toBeVisible({
        timeout: 60_000,
      })
    } finally {
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
