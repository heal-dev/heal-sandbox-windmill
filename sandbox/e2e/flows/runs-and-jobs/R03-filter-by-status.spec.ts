import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import { runScriptViaApi, waitForJobCompletion } from '../../helpers/jobsApi'

test.describe('@flow @feature:runs-and-jobs @worker R03 — Filter runs history by Status=Success', () => {
  test('Status=success narrows the runs list to only the passing script', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const okSlug = `r03-ok-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const failSlug = `r03-fail-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const okPath = `u/admin/${okSlug}`
    const failPath = `u/admin/${failSlug}`

    try {
      await tryDeleteScriptViaApi(request, auth, okPath)
      await tryDeleteScriptViaApi(request, auth, failPath)

      await createScriptViaApi(request, auth, {
        path: okPath,
        language: 'python3',
        content: `def main():\n    # ns: ${okSlug}\n    return 'hello windmill'\n`,
        summary: `R03 ok ${okSlug}`,
      })
      await createScriptViaApi(request, auth, {
        path: failPath,
        language: 'python3',
        content: `def main():\n    # ns: ${failSlug}\n    raise RuntimeError('boom-${failSlug}')\n`,
        summary: `R03 fail ${failSlug}`,
      })

      const okJobId = await runScriptViaApi(request, auth, { path: okPath })
      const failJobId = await runScriptViaApi(request, auth, { path: failPath })
      await waitForJobCompletion(request, auth, okJobId, { timeoutMs: 60_000 })
      await waitForJobCompletion(request, auth, failJobId, { timeoutMs: 60_000 })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      // The Status filter is URL-synced (RunsPage useUrlSyncedFilterInstance).
      // The filter key is `status` with oneof values from runsFilter.ts (lines
      // 162-168). Hitting /runs?status=success asks the backend for
      // success-only rows; this avoids brittle dropdown UI navigation and
      // tests the substantive claim that the filtered table excludes failures.
      await page.goto(`${FRONTEND_URL}/runs?status=success`)
      await expect(page.getByRole('heading', { name: /^Runs$/i })).toBeVisible({
        timeout: 30_000,
      })

      // Passing script row visible.
      await expect(page.getByText(new RegExp(okSlug, 'i')).first()).toBeVisible({
        timeout: 60_000,
      })
      // Failing script row absent.
      await expect(page.getByText(new RegExp(failSlug, 'i'))).toHaveCount(0)
    } finally {
      await deleteScriptViaApi(request, auth, okPath).catch(() => {})
      await deleteScriptViaApi(request, auth, failPath).catch(() => {})
    }
  })
})
