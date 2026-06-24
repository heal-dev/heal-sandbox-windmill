import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createFlowViaApi,
  deleteFlowViaApi,
  tryDeleteFlowViaApi,
  runFlowViaApi,
  twoStepEchoFlowValue,
} from '../../helpers/flowsApi'
import { waitForJobCompletion } from '../../helpers/jobsApi'

test.describe('@flow @feature:flows @worker F05 — Flow run shows per-step status', () => {
  test('/run/<jobId> for a 2-step flow surfaces both module step IDs', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `f05-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const flowPath = `u/admin/${slug}`

    try {
      await tryDeleteFlowViaApi(request, auth, flowPath)
      await createFlowViaApi(request, auth, {
        path: flowPath,
        summary: `F05 ${slug}`,
        description: `ns:${slug}`,
        value: twoStepEchoFlowValue(slug),
      })

      const jobId = await runFlowViaApi(request, auth, flowPath)
      await waitForJobCompletion(request, auth, jobId, { timeoutMs: 90_000 })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/run/${jobId}`)

      await expect(
        page.getByRole('heading', { name: new RegExp(`^run/${jobId}`, 'i'), level: 1 }),
      ).toBeVisible({ timeout: 30_000 })

      // FlowProgressBar (run/+page.svelte line 813) renders with
      // showStepId — both module IDs should show somewhere in the
      // graph area.
      await expect(page.locator('text="a"').first()).toBeVisible({ timeout: 60_000 })
      await expect(page.locator('text="b"').first()).toBeVisible({ timeout: 60_000 })
    } finally {
      await deleteFlowViaApi(request, auth, flowPath).catch(() => {})
    }
  })
})
