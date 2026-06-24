import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import { runScriptViaApi, waitForJobCompletion } from '../../helpers/jobsApi'

test.describe('@scenario @feature:runs-and-jobs @worker R05.S2 — No Cancel on completed job', () => {
  test('Cancel button is not rendered for a CompletedJob', async ({ page, request, fx }) => {
    const auth = await loginAdmin(request)
    const slug = `r05s2-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`

    try {
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    # ns: ${slug}\n    return 'hello windmill'\n`,
        summary: `R05.S2 ${slug}`,
      })

      const jobId = await runScriptViaApi(request, auth, { path: scriptPath })
      await waitForJobCompletion(request, auth, jobId, { timeoutMs: 60_000 })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/run/${jobId}`)
      await expect(
        page.getByRole('heading', { name: new RegExp(`^run/${jobId}`, 'i'), level: 1 }),
      ).toBeVisible({ timeout: 30_000 })

      // Wait for the action row to render. 'Run again' is the canonical sibling
      // CTA for a completed script job — once it appears the Cancel slot has
      // been evaluated and we can assert its absence.
      await expect(page.getByRole('button', { name: /^Run again$/ }).first()).toBeVisible({
        timeout: 30_000,
      })

      // Cancel button must not be rendered for CompletedJob.
      // (Force Cancel only appears after a prior cancel attempt, so it must
      // also be absent on a fresh page load.)
      await expect(page.getByRole('button', { name: /^Cancel$/ })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /^Force Cancel$/ })).toHaveCount(0)
    } finally {
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
