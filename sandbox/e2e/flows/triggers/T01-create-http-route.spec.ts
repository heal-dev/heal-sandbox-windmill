import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import {
  tryDeleteHttpRouteViaApi,
  deleteHttpRouteViaApi,
  listHttpRoutesViaApi,
} from '../../helpers/triggersApi'

test.describe('@flow @feature:triggers @worker T01 — Create an HTTP route targeting a script', () => {
  test('Open editor from /routes, pick a script, fill route_path + POST, save → row appears', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `t01-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`
    // Route path-name leaf (joined with the Path widget prefix u/admin) and
    // route_path slug (the public URL segment under /api/r/<wid>/...).
    const routeLeaf = `r-${slug}`
    const routePath = `u/admin/${routeLeaf}`
    // The route_path slug must satisfy VALID_ROUTE_PATH_RE: only
    // [-\w] segments separated by '/'. Keep it slug-like.
    const routePublic = slug

    try {
      await tryDeleteHttpRouteViaApi(request, auth, routePath)
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    # ns: ${slug}\n    return 'hello-${slug}'\n`,
        summary: `T01 ${slug}`,
      })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/routes`)
      await expect(page.getByRole('heading', { name: /Custom HTTP routes/i })).toBeVisible({
        timeout: 30_000,
      })

      // "New route" — the markup uses a non-breaking space ("New route").
      // Match on the visible character class.
      await page
        .getByRole('button', { name: /^New\s*route$/ })
        .first()
        .click()

      // Drawer opens; the route-editor header is the title text of the drawer.
      // It also reliably surfaces the "HTTP" section heading from
      // RouteEditorConfigSection.
      await expect(page.getByText(/^HTTP$/).first()).toBeVisible({ timeout: 15_000 })

      // Fill summary so the row's display name is deterministic.
      const summaryField = page
        .getByRole('textbox', { name: /^Summary$/i })
        .or(page.getByPlaceholder(/Short summary|summary/i))
        .first()
      if (await summaryField.isVisible().catch(() => false)) {
        await summaryField.fill(`T01 ${slug}`)
      }

      // Path widget — the path-leaf textbox. The Path component renders an
      // input with placeholder "route" (RouteEditor passes namePlaceholder).
      const pathLeaf = page
        .getByRole('textbox', { name: /^route$/i })
        .or(page.getByPlaceholder(/^route$/))
        .first()
      await pathLeaf.fill(routeLeaf)

      // Pick the deployed script via ScriptPicker. The picker is a button-like
      // affordance with a search input; clicking opens a list/menu.
      const scriptPicker = page
        .getByRole('textbox', { name: /Pick a script|Search a script/i })
        .or(page.getByPlaceholder(/Pick a script|Search a script/i))
        .first()
      await scriptPicker.click()
      await scriptPicker.fill(slug)
      await page
        .getByRole('option', { name: new RegExp(slug, 'i') })
        .or(page.getByRole('menuitem', { name: new RegExp(slug, 'i') }))
        .or(page.getByText(new RegExp(scriptPath.replace(/\//g, '/'), 'i')))
        .first()
        .click()

      // HTTP section — route_path textbox.
      // The TextInput in RouteEditorConfigSection.svelte (L163-173) has the
      // ':myparam'/'wildcard' helper directly under it which Svelte joins into
      // the input's accessible name as "Path Use ':myparam' for path params
      // and '*mywildcard' for wildcards". Match on the trailing helper text.
      const routePathInput = page
        .getByRole('textbox', { name: /Use ':myparam'/ })
        .first()
      await routePathInput.fill(routePublic)

      // POST is the default; assert it's pressed.
      // (No-op if already selected.)
      await page
        .getByRole('button', { name: /^POST$/ })
        .first()
        .click()
        .catch(() => {})

      // Save the drawer. dispatchEvent('click') sidesteps any overlay-click
      // races (the gotcha noted in the brief).
      await page
        .getByRole('button', { name: /^Save|^Save & Deploy|^Save$/ })
        .first()
        .dispatchEvent('click')

      // Verify the row appears via the API list (drawer→list refresh races).
      await expect
        .poll(
          async () => {
            const rows = await listHttpRoutesViaApi(request, auth)
            return rows.find((r) => r.path === routePath)?.http_method ?? ''
          },
          { timeout: 30_000 },
        )
        .toBe('post')

      // And re-render the list, then assert the row is visible by trigger path.
      await page.goto(`${FRONTEND_URL}/routes`)
      await expect(page.getByText(new RegExp(routeLeaf, 'i')).first()).toBeVisible({
        timeout: 30_000,
      })
    } finally {
      await deleteHttpRouteViaApi(request, auth, routePath).catch(() => {})
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
