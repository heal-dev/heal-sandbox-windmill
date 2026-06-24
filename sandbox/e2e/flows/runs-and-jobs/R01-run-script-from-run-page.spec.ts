import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'

test.describe('@flow @feature:runs-and-jobs @worker R01 — Run script from its detail page', () => {
  test('Submitting the Run form lands on /run/<jobId> and shows the return value', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `r01-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`

    try {
      // Defensive: clear any leftover from a prior failed run.
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    # ns: ${slug}\n    return 'hello windmill'\n`,
        summary: `R01 ${slug}`,
      })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/scripts/get/${scriptPath}`)
      await page.waitForURL(/\/scripts\/get\//, { timeout: 30_000 })

      // The auto-generated RunForm Run button — no args required for our body.
      const runButton = page.getByRole('button', { name: /^Run(?:\b|$|\s)/ }).first()
      await expect(runButton).toBeEnabled({ timeout: 30_000 })
      await runButton.click()

      await page.waitForURL(/\/run\//, { timeout: 60_000 })
      const url = new URL(page.url())
      const jobId = url.pathname.replace(/^\/run\//, '').split('/')[0]
      expect(jobId, 'jobId captured from /run/ URL').not.toBe('')

      // Job-detail h1 is the literal "run/<jobId>".
      await expect(
        page.getByRole('heading', { name: new RegExp(`^run/${jobId}`, 'i'), level: 1 }),
      ).toBeVisible({ timeout: 30_000 })

      // Result panel renders the script's return value.
      await expect(page.getByText(/hello windmill/i).first()).toBeVisible({ timeout: 60_000 })
    } finally {
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
