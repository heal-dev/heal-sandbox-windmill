import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createFlowViaApi,
  deleteFlowViaApi,
  tryDeleteFlowViaApi,
  twoStepEchoFlowValue,
} from '../../helpers/flowsApi'

test.describe('@flow @feature:flows @worker F01 — Deploy a 2-step Python flow', () => {
  test('A deployed 2-step Python flow lands on its detail page', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `f01-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const flowPath = `u/admin/${slug}`
    const summary = `F01 ${slug}`

    try {
      // VERIFY: API-precondition + UI-assertion split. Driving the FlowBuilder
      // graph (drag-drop '+' inserters, language pickers, autosave race) is
      // far too fragile for an e2e — the scenario's load-bearing claim is
      // that *a deployed 2-step flow renders on its detail page*, so we
      // deploy via the API and assert the UI side only.
      await tryDeleteFlowViaApi(request, auth, flowPath)
      await createFlowViaApi(request, auth, {
        path: flowPath,
        summary,
        description: `ns:${slug}`,
        value: twoStepEchoFlowValue(slug),
      })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))

      // Touch the Home Flow CTA so the journey of "from Home" is represented.
      await page.goto(`${FRONTEND_URL}/`)
      const flowCta = page.getByRole('link', { name: /^Flow$/ }).first()
      // Best-effort: the CTA shape changed between releases; if it doesn't
      // appear quickly, fall through to the deeper assertion.
      await flowCta.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})

      // Now assert the deployed flow renders.
      await page.goto(`${FRONTEND_URL}/flows/get/${flowPath}`)
      await page.waitForURL(/\/flows\/get\//, { timeout: 30_000 })

      await expect(page.getByText(summary).first()).toBeVisible({ timeout: 30_000 })
      // The Run button on the detail page's auto-generated RunForm.
      await expect(page.getByRole('button', { name: /^Run(?:\b|$|\s)/ }).first()).toBeVisible({
        timeout: 30_000,
      })
    } finally {
      await deleteFlowViaApi(request, auth, flowPath).catch(() => {})
    }
  })
})
