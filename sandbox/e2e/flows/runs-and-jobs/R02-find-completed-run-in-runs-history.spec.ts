import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import { runScriptViaApi, waitForJobCompletion } from '../../helpers/jobsApi'

test.describe('@flow @feature:runs-and-jobs @worker R02 — Completed run shows on /runs', () => {
  test('A completed run appears as a row referencing the script path on /runs', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `r02-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`

    try {
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    # ns: ${slug}\n    return 'hello windmill'\n`,
        summary: `R02 ${slug}`,
      })

      // API precondition: trigger the script once and wait for completion so a
      // history row exists by the time the UI loads /runs.
      const jobId = await runScriptViaApi(request, auth, { path: scriptPath })
      await waitForJobCompletion(request, auth, jobId, { timeoutMs: 60_000 })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/runs`)
      await expect(page.getByRole('heading', { name: /^Runs$/i })).toBeVisible({
        timeout: 30_000,
      })

      // Either the script path appears verbatim in a Path cell, or as part
      // of the runnable href shown in the row. Match on the slug substring.
      await expect(page.getByText(new RegExp(slug, 'i')).first()).toBeVisible({
        timeout: 60_000,
      })
    } finally {
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
