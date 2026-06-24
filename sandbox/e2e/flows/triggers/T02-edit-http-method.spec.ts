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

test.describe('@flow @feature:triggers @worker T02 — Switch http_method on an existing route', () => {
  test('Open editor, flip POST→GET, save → API reports GET', async ({ page, request, fx }) => {
    const auth = await loginAdmin(request)
    const slug = `t02-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
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
        summary: `T02 ${slug}`,
      })
      await createHttpRouteViaApi(request, auth, {
        path: routePath,
        route_path: routePublic,
        http_method: 'post',
        script_path: scriptPath,
        summary: `T02 ${slug}`,
      })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/routes`)
      await expect(page.getByRole('heading', { name: /Custom HTTP routes/i })).toBeVisible({
        timeout: 30_000,
      })

      // Ensure the row is in the DOM before clicking Edit. The row's
      // trigger-path label is `routePath` (rendered in a secondary line).
      await expect(page.getByText(new RegExp(routePath.replace(/\//g, '\\/'), 'i')).first())
        .toBeVisible({ timeout: 30_000 })

      // Each row's anchor is `<a href="#{path}">` — Svelte renders it as
      // role=link whose accessible name includes both the summary and the
      // trigger path. Scope to that link, then go up to its row container.
      const rowLink = page.getByRole('link', { name: new RegExp(routePath.replace(/\//g, '\\/'), 'i') }).first()
      await expect(rowLink).toBeVisible({ timeout: 15_000 })
      // Smallest ancestor row container — the row's flex parent contains the
      // Edit button as a sibling. xpath=ancestor::div[1] climbs to the next
      // outer div.
      const row = rowLink.locator('xpath=ancestor::div[contains(@class, "flex")][1]')
      await row.getByRole('button', { name: /^Edit$/ }).first().click()

      // Drawer opens with the HTTP section.
      await expect(page.getByText(/^HTTP$/).first()).toBeVisible({ timeout: 15_000 })

      // Switch POST → GET. The http_method ToggleButtonGroup renders as
      // role=radio per option (see T01 snapshot: `radio "GET"`).
      await page.getByRole('radio', { name: /^GET$/ }).first().click()

      // Save.
      await page
        .getByRole('button', { name: /^Save( & Deploy)?$/ })
        .first()
        .dispatchEvent('click')

      // Verify the persisted http_method via API.
      await expect
        .poll(
          async () => {
            const r = await getHttpRouteViaApi(request, auth, routePath)
            return r.ok ? (r.body?.http_method ?? '') : ''
          },
          { timeout: 30_000 },
        )
        .toBe('get')
    } finally {
      await deleteHttpRouteViaApi(request, auth, routePath).catch(() => {})
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
