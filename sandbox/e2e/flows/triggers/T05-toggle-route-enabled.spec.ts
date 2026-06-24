import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import {
  createHttpRouteViaApi,
  deleteHttpRouteViaApi,
  getHttpRouteViaApi,
  tryDeleteHttpRouteViaApi,
} from '../../helpers/triggersApi'

test.describe('@flow @feature:triggers @worker T05 — Toggle a route enabled → disabled', () => {
  test('Flip TriggerModeToggle on the row; API reports mode=disabled', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `t05-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`
    const routePath = `u/admin/r-${slug}`
    const routePublic = slug

    try {
      await tryDeleteHttpRouteViaApi(request, auth, routePath)
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    # ns: ${slug}\n    return 'hello-${slug}'\n`,
        summary: `T05 ${slug}`,
      })
      await createHttpRouteViaApi(request, auth, {
        path: routePath,
        route_path: routePublic,
        http_method: 'post',
        script_path: scriptPath,
        summary: `T05 ${slug}`,
        enabled: true,
      })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/routes`)
      await expect(page.getByRole('heading', { name: /Custom HTTP routes/i })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText(new RegExp(routePath.replace(/\//g, '\\/'), 'i')).first())
        .toBeVisible({ timeout: 30_000 })

      // Anchor on the row's <a href="#u/admin/..."> link (Svelte role=link).
      // Climb to the smallest flex ancestor — that container holds the row's
      // toggle, Edit button and kebab as siblings of the link.
      const rowLink = page.getByRole('link', { name: new RegExp(routePath.replace(/\//g, '\\/'), 'i') }).first()
      await expect(rowLink).toBeVisible({ timeout: 15_000 })
      const row = rowLink.locator('xpath=ancestor::div[contains(@class, "flex")][1]')

      // TriggerModeToggle is a <Toggle> over an `<input type="checkbox"
      // class="sr-only">`. role=checkbox finds it; Playwright's `.click()`
      // forwards to the visible label / styled track, but the sr-only input
      // is what isChecked() reflects. dispatchEvent('click') sidesteps any
      // pointer/animation interception.
      const toggle = row.getByRole('checkbox').first()
      await expect(toggle).toBeAttached({ timeout: 15_000 })
      const initiallyChecked = await toggle.isChecked().catch(() => true)
      expect(initiallyChecked).toBe(true)

      try {
        await toggle.click({ timeout: 5000 })
      } catch {
        await toggle.dispatchEvent('click')
      }

      // Verify the persisted state via API. TriggerModeToggle on a row maps
      // to setHttpTriggerMode('disabled'); the GET returns mode='disabled'.
      await expect
        .poll(
          async () => {
            const r = await getHttpRouteViaApi(request, auth, routePath)
            return r.ok ? (r.body?.mode ?? '') : ''
          },
          { timeout: 30_000 },
        )
        .toBe('disabled')
    } finally {
      await deleteHttpRouteViaApi(request, auth, routePath).catch(() => {})
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
