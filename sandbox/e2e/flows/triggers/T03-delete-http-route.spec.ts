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

test.describe('@flow @feature:triggers @worker T03 — Delete an HTTP route', () => {
  test('Open row dropdown → Delete → row disappears + GET 404', async ({ page, request, fx }) => {
    const auth = await loginAdmin(request)
    const slug = `t03-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
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
        summary: `T03 ${slug}`,
      })
      await createHttpRouteViaApi(request, auth, {
        path: routePath,
        route_path: routePublic,
        http_method: 'post',
        script_path: scriptPath,
        summary: `T03 ${slug}`,
      })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/routes`)
      await expect(page.getByRole('heading', { name: /Custom HTTP routes/i })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText(new RegExp(routePath.replace(/\//g, '\\/'), 'i')).first())
        .toBeVisible({ timeout: 30_000 })

      // The kebab is a small unnamed button rendered as a sibling of the
      // Edit/Copy buttons inside the row's action group. Anchor on the row's
      // <a href="#u/admin/..."> link, climb to the row container, then pick
      // the last <button> with no accessible name — Dropdown renders it
      // (Svelte) as a button containing a MoreVertical/Ellipsis svg.
      const rowLink = page.getByRole('link', { name: new RegExp(routePath.replace(/\//g, '\\/'), 'i') }).first()
      await expect(rowLink).toBeVisible({ timeout: 15_000 })
      const row = rowLink.locator('xpath=ancestor::div[contains(@class, "flex")][1]')

      // Auto-accept any confirm() dialog the Delete action raises.
      page.on('dialog', (d) => {
        d.accept().catch(() => {})
      })

      // Try every known kebab-button shape.
      const kebabCandidates = [
        row.locator('button:has(svg.lucide-ellipsis-vertical)'),
        row.locator('button:has(svg.lucide-more-vertical)'),
        row.locator('button[aria-haspopup="menu"]'),
        // Final fallback: the last unnamed button in the row's action area.
        row.getByRole('button').filter({ has: page.locator('svg') }).last(),
      ]
      let opened = false
      for (const cand of kebabCandidates) {
        const first = cand.first()
        if (await first.isVisible().catch(() => false)) {
          await first.click({ timeout: 5000 }).catch(() => {})
          if (
            await page
              .getByRole('menuitem', { name: /^Delete$/i })
              .first()
              .isVisible({ timeout: 1500 })
              .catch(() => false)
          ) {
            opened = true
            break
          }
        }
      }
      expect(opened, 'kebab dropdown should open for the route row').toBe(true)

      await page.getByRole('menuitem', { name: /^Delete$/i }).first().click()

      // Verify via API the route is gone.
      await expect
        .poll(
          async () => {
            const r = await getHttpRouteViaApi(request, auth, routePath)
            return r.status
          },
          { timeout: 30_000 },
        )
        .toBe(404)

      // The row should disappear from the UI list as well.
      await expect(page.getByText(new RegExp(routePath.replace(/\//g, '\\/'), 'i'))).toHaveCount(0)
    } finally {
      await deleteHttpRouteViaApi(request, auth, routePath).catch(() => {})
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
