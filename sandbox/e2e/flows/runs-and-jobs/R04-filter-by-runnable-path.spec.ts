import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import { runScriptViaApi, waitForJobCompletion } from '../../helpers/jobsApi'

test.describe('@flow @feature:runs-and-jobs @worker R04 — Filter runs history by runnable path', () => {
  test('Visiting /runs/<scriptPath> narrows the table to that runnable only', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const aSlug = `r04-a-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const bSlug = `r04-b-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const aPath = `u/admin/${aSlug}`
    const bPath = `u/admin/${bSlug}`

    try {
      await tryDeleteScriptViaApi(request, auth, aPath)
      await tryDeleteScriptViaApi(request, auth, bPath)

      await createScriptViaApi(request, auth, {
        path: aPath,
        language: 'python3',
        content: `def main():\n    # ns: ${aSlug}\n    return 'a-${aSlug}'\n`,
        summary: `R04 a ${aSlug}`,
      })
      await createScriptViaApi(request, auth, {
        path: bPath,
        language: 'python3',
        content: `def main():\n    # ns: ${bSlug}\n    return 'b-${bSlug}'\n`,
        summary: `R04 b ${bSlug}`,
      })

      const aJobId = await runScriptViaApi(request, auth, { path: aPath })
      const bJobId = await runScriptViaApi(request, auth, { path: bPath })
      await waitForJobCompletion(request, auth, aJobId, { timeoutMs: 60_000 })
      await waitForJobCompletion(request, auth, bJobId, { timeoutMs: 60_000 })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      // /runs/<scriptPath> seeds initialPath -> filters.val.path is the runnable.
      await page.goto(`${FRONTEND_URL}/runs/${aPath}`)
      await expect(page.getByRole('heading', { name: /^Runs$/i })).toBeVisible({
        timeout: 30_000,
      })

      // The path-filtered table should contain script A but not script B.
      await expect(page.getByText(new RegExp(aSlug, 'i')).first()).toBeVisible({
        timeout: 60_000,
      })
      await expect(page.getByText(new RegExp(bSlug, 'i'))).toHaveCount(0)
    } finally {
      await deleteScriptViaApi(request, auth, aPath).catch(() => {})
      await deleteScriptViaApi(request, auth, bPath).catch(() => {})
    }
  })
})
