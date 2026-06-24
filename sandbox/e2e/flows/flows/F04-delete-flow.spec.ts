import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, API_BASE, SEED } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createFlowViaApi,
  deleteFlowViaApi,
  tryDeleteFlowViaApi,
  oneStepFlowValue,
} from '../../helpers/flowsApi'

test.describe('@flow @feature:flows @worker F04 — Delete a flow', () => {
  test('Deleting a flow from its detail-page menu removes it from the workspace', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `f04-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const flowPath = `u/admin/${slug}`

    try {
      await tryDeleteFlowViaApi(request, auth, flowPath)
      await createFlowViaApi(request, auth, {
        path: flowPath,
        summary: `F04 ${slug}`,
        description: `ns:${slug}`,
        value: oneStepFlowValue(slug),
      })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/flows/get/${flowPath}`)
      await page.waitForURL(/\/flows\/get\//, { timeout: 30_000 })
      // Wait for the page to render the flow summary before going for the kebab.
      await expect(page.getByText(`F04 ${slug}`).first()).toBeVisible({ timeout: 30_000 })

      // The DetailPageHeader actions menu is a kebab/MoreVertical button.
      // Several variants exist across releases (button with no name, ariaLabel
      // "Open menu", etc.) — try a few in priority order, accept the first hit.
      // Auto-dismiss the browser-native confirm() dialog the moment it pops.
      page.on('dialog', (d) => {
        d.accept().catch(() => {})
      })

      let opened = false
      const candidates = [
        page.getByRole('button', { name: /^More(\s|$)/i }),
        page.getByRole('button', { name: /^(Open|Actions?) menu/i }),
        page.locator('button[aria-haspopup="menu"]'),
        page.locator('button:has(svg.lucide-ellipsis-vertical)'),
        page.locator('button:has(svg.lucide-more-vertical)'),
      ]
      for (const cand of candidates) {
        const first = cand.first()
        if (await first.isVisible().catch(() => false)) {
          await first.click().catch(() => {})
          // Did a Delete menu item appear?
          const del = page.getByRole('menuitem', { name: /^Delete$/i }).first()
          if (await del.isVisible({ timeout: 1500 }).catch(() => false)) {
            opened = true
            break
          }
        }
      }

      if (opened) {
        await page.getByRole('menuitem', { name: /^Delete$/i }).first().click()
      } else {
        // Fallback: just hit any Delete-labelled control visible on the page.
        const directDelete = page.getByRole('button', { name: /^Delete$/i }).first()
        if (await directDelete.isVisible().catch(() => false)) {
          await directDelete.click()
        } else {
          // Last-ditch: skip the UI and delete via API so the assertion side
          // (flow no longer exists) still runs; mark the test as failing on
          // the UI path with an explicit message.
          await deleteFlowViaApi(request, auth, flowPath)
          throw new Error(
            'F04: could not locate a Delete affordance on the flow detail page — UI selector drift.',
          )
        }
      }

      // The page should navigate away (FlowGet's deleteFlow goto's '/').
      await page.waitForURL((u) => !/\/flows\/get\//.test(u.toString()), {
        timeout: 30_000,
      }).catch(() => {})

      // Verify via API that the flow is gone.
      const res = await request.get(`${API_BASE}/w/${SEED.workspace.id}/flows/get/${flowPath}`, {
        headers: { Cookie: auth.cookie },
      })
      expect(res.status(), 'flow GET should 404 after delete').toBe(404)
    } finally {
      // Defensive cleanup — if the test failed before the UI delete fired.
      await deleteFlowViaApi(request, auth, flowPath).catch(() => {})
    }
  })
})
