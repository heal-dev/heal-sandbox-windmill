import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import { runScriptViaApi, waitForJobCompletion } from '../../helpers/jobsApi'

test.describe('@flow @feature:runs-and-jobs @worker R06 — Re-run a completed job', () => {
  test('Run again queues a fresh job whose detail page loads with the same script', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `r06-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`

    try {
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    # ns: ${slug}\n    return 'hello windmill'\n`,
        summary: `R06 ${slug}`,
      })

      const originalJobId = await runScriptViaApi(request, auth, { path: scriptPath })
      await waitForJobCompletion(request, auth, originalJobId, { timeoutMs: 60_000 })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/run/${originalJobId}`)
      await expect(
        page.getByRole('heading', { name: new RegExp(`^run/${originalJobId}`, 'i'), level: 1 }),
      ).toBeVisible({ timeout: 30_000 })

      // 'Run again' is a Button that goto's /scripts/get/<hash>#<argsHash>.
      const runAgainBtn = page.getByRole('button', { name: /^Run again$/ }).first()
      await expect(runAgainBtn).toBeVisible({ timeout: 30_000 })
      await runAgainBtn.click()

      // Wait for the script form to reload.
      await page.waitForURL(/\/scripts\/get\//, { timeout: 30_000 })

      // Submit the auto-generated RunForm again.
      const runBtn = page.getByRole('button', { name: /^Run(?:\b|$|\s)/ }).first()
      await expect(runBtn).toBeEnabled({ timeout: 30_000 })
      await runBtn.click()

      await page.waitForURL(/\/run\//, { timeout: 60_000 })
      const url = new URL(page.url())
      const newJobId = url.pathname.replace(/^\/run\//, '').split('/')[0]
      expect(newJobId, 'new jobId differs from original').not.toBe(originalJobId)
      expect(newJobId).not.toBe('')

      await expect(page.getByText(/hello windmill/i).first()).toBeVisible({ timeout: 60_000 })
    } finally {
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
