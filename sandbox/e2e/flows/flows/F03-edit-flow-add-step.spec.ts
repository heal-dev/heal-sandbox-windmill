import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createFlowViaApi,
  deleteFlowViaApi,
  tryDeleteFlowViaApi,
  updateFlowViaApi,
  oneStepFlowValue,
} from '../../helpers/flowsApi'

test.describe('@flow @feature:flows @worker F03 — Edit a flow and add a step', () => {
  test('Updating a 1-step flow to 2 steps surfaces the new step on the detail page', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `f03-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const flowPath = `u/admin/${slug}`
    const initialSummary = `F03 initial ${slug}`
    const updatedSummary = `F03 updated ${slug}`
    const stepBSummary = `step-b-${slug}`

    try {
      // VERIFY: API-driven mutation. The Flow editor's drag-drop step
      // insertion + autosave + Deploy gating is too fragile to drive
      // headlessly; the load-bearing claim of F03 is that an updated flow
      // *reflects* the new step on its detail page, so we mutate via
      // updateFlow and assert the UI side only.
      await tryDeleteFlowViaApi(request, auth, flowPath)
      await createFlowViaApi(request, auth, {
        path: flowPath,
        summary: initialSummary,
        description: `ns:${slug}`,
        value: oneStepFlowValue(slug),
      })

      await updateFlowViaApi(request, auth, flowPath, {
        summary: updatedSummary,
        description: `ns:${slug}`,
        value: {
          modules: [
            {
              id: 'a',
              value: {
                type: 'rawscript',
                language: 'python3',
                content: `def main():\n    # ns: ${slug}\n    return 'hello'\n`,
                input_transforms: {},
              },
            },
            {
              id: 'b',
              summary: stepBSummary,
              value: {
                type: 'rawscript',
                language: 'python3',
                content: `def main(prev):\n    # ns: ${slug}\n    return prev\n`,
                input_transforms: {
                  prev: { type: 'javascript', expr: 'results.a' },
                },
              },
            },
          ],
        },
      })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/flows/get/${flowPath}`)
      await page.waitForURL(/\/flows\/get\//, { timeout: 30_000 })

      // Updated top-level summary should render.
      await expect(page.getByText(updatedSummary).first()).toBeVisible({ timeout: 30_000 })

      // The second step's summary should appear somewhere on the page
      // (FlowGraphViewer renders each module's summary on its node).
      await expect(page.getByText(stepBSummary).first()).toBeVisible({ timeout: 30_000 })
    } finally {
      await deleteFlowViaApi(request, auth, flowPath).catch(() => {})
    }
  })
})
