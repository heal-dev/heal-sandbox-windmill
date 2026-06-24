import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import {
  getCompletedJobViaApi,
  runScriptViaApi,
  waitForJobCompletion,
} from '../../helpers/jobsApi'

test.describe('@flow @feature:runs-and-jobs @worker R07 — View a failed job on /run/<jobId>', () => {
  test('A failed run renders the error payload on its detail page', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `r07-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`
    const boomToken = `boom-${slug}`

    try {
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    # ns: ${slug}\n    raise RuntimeError('${boomToken}')\n`,
        summary: `R07 ${slug}`,
      })

      const jobId = await runScriptViaApi(request, auth, { path: scriptPath })
      const completed = await waitForJobCompletion(request, auth, jobId, {
        timeoutMs: 60_000,
      })

      // Substantive backend-side claim: the job is recorded as a failure.
      expect(completed.success, 'failed job should have success=false').toBeFalsy()
      const fresh = await getCompletedJobViaApi(request, auth, jobId)
      expect(fresh.success).toBeFalsy()

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/run/${jobId}`)
      await expect(
        page.getByRole('heading', { name: new RegExp(`^run/${jobId}`, 'i'), level: 1 }),
      ).toBeVisible({ timeout: 30_000 })

      // The Result panel renders the RuntimeError message via DisplayResult.
      await expect(page.getByText(new RegExp(boomToken)).first()).toBeVisible({
        timeout: 30_000,
      })
    } finally {
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
