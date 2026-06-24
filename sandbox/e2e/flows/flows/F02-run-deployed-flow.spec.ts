import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createFlowViaApi,
  deleteFlowViaApi,
  tryDeleteFlowViaApi,
  twoStepEchoFlowValue,
} from '../../helpers/flowsApi'

test.describe('@flow @feature:flows @worker F02 — Run a deployed flow', () => {
  test('Submitting the RunForm goto\'s /run/<jobId> and shows the flow result', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `f02-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const flowPath = `u/admin/${slug}`
    const payload = `hello from ${slug}`

    try {
      await tryDeleteFlowViaApi(request, auth, flowPath)
      await createFlowViaApi(request, auth, {
        path: flowPath,
        summary: `F02 ${slug}`,
        description: `ns:${slug}`,
        value: twoStepEchoFlowValue(slug, payload),
      })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/flows/get/${flowPath}`)
      await page.waitForURL(/\/flows\/get\//, { timeout: 30_000 })

      const runButton = page.getByRole('button', { name: /^Run(?:\b|$|\s)/ }).first()
      await expect(runButton).toBeEnabled({ timeout: 30_000 })
      await runButton.click()

      await page.waitForURL(/\/run\//, { timeout: 60_000 })
      const url = new URL(page.url())
      const jobId = url.pathname.replace(/^\/run\//, '').split('/')[0]
      expect(jobId, 'jobId captured from /run/ URL').not.toBe('')

      await expect(
        page.getByRole('heading', { name: new RegExp(`^run/${jobId}`, 'i'), level: 1 }),
      ).toBeVisible({ timeout: 30_000 })

      // The payload comes from step a and is echoed by step b — once the
      // flow completes the Result panel shows it. Allow a generous wait
      // because two-step flow jobs take longer than single-step scripts.
      await expect(page.getByText(payload).first()).toBeVisible({ timeout: 90_000 })
    } finally {
      await deleteFlowViaApi(request, auth, flowPath).catch(() => {})
    }
  })
})
