import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import {
  cancelJobViaApi,
  getJobViaApi,
  runScriptViaApi,
  waitForJobCompletion,
} from '../../helpers/jobsApi'

test.describe('@flow @feature:runs-and-jobs @worker R05 — Cancel a running job from /run/<jobId>', () => {
  test('Clicking Cancel cancels the running job', async ({ page, request, fx }) => {
    const auth = await loginAdmin(request)
    const slug = `r05-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`
    let jobId = ''

    try {
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        // 60s sleep gives ample headroom for the UI click + backend cancel
        // round-trip even on a slow CI worker.
        content: `import time\n\ndef main():\n    # ns: ${slug}\n    time.sleep(60)\n    return 'done'\n`,
        summary: `R05 ${slug}`,
      })

      jobId = await runScriptViaApi(request, auth, { path: scriptPath })
      expect(jobId).not.toBe('')

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/run/${jobId}`)
      await expect(
        page.getByRole('heading', { name: new RegExp(`^run/${jobId}`, 'i'), level: 1 }),
      ).toBeVisible({ timeout: 30_000 })

      // The Cancel button only renders while job.type != 'CompletedJob' AND
      // (no schedule_path OR job.running == true). For our just-launched
      // script it should be visible quickly.
      const cancelBtn = page.getByRole('button', { name: /^Cancel$/ }).first()
      await expect(cancelBtn).toBeVisible({ timeout: 30_000 })
      await cancelBtn.click()

      // Wait for the backend to record the cancel. The job moves to a
      // CompletedJob with canceled=true.
      const completed = await waitForJobCompletion(request, auth, jobId, {
        timeoutMs: 60_000,
      })
      expect(completed.canceled, 'completed job should be marked canceled').toBeTruthy()
    } finally {
      // Best-effort: if the UI didn't drive the cancel, force it via API so
      // the worker isn't stuck on a 60s sleep.
      if (jobId) {
        const { ok, body } = await getJobViaApi(request, auth, jobId)
        if (ok && body?.type !== 'CompletedJob') {
          await cancelJobViaApi(request, auth, jobId).catch(() => {})
        }
      }
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
