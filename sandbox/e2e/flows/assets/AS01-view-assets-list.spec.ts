import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createResource,
  deleteResource,
} from '../../helpers/varResApi'
import { createScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import { listAssetsViaApi } from '../../helpers/assetsApi'

test.describe('@flow @feature:assets @worker AS01 — View Assets list', () => {
  test('A resource referenced by a deployed script appears in the Latest assets DataTable', async ({
    page,
    request,
    fx,
  }) => {
    const slug = `as01-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32)
    const resPath = `u/admin/${slug}`
    const scriptPath = `u/admin/${slug}_script`
    const auth = await loginAdmin(request)

    // The walked truth: variables do NOT auto-register as `asset` rows (the
    // parser only emits asset entries for resources / S3 / etc.), and even a
    // resource only surfaces in /api/.../assets/list once a script or flow
    // calls it through wmill.get_resource(...) — the list_assets SQL filters
    // out asset rows whose usage_path no longer points at a live script/flow.
    // So the precondition is: create a resource AND deploy a referencing script.
    await tryDeleteScriptViaApi(request, auth, scriptPath)
    await deleteResource(request, auth, resPath).catch(() => {})
    try {
      await createResource(request, auth, resPath, 'postgresql', { host: 'h' })
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        // wmill.get_resource is parsed at deploy time; the asset row is
        // inserted into the `asset` table inside the same tx as scripts/create.
        content: `import wmill\n\ndef main():\n    return wmill.get_resource("${resPath}")\n`,
        summary: 'assets AS01',
      })

      // API precondition: the assets/list endpoint reports our resource.
      const apiList = await listAssetsViaApi(request, auth, { assetPath: slug })
      const ours = apiList.assets.find((a) => a.kind === 'resource' && a.path === resPath)
      expect(ours, 'resource asset row exists after script deploy').toBeTruthy()

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/assets`)

      // +page.js sets stuff.title = 'Assets' -> document title "Assets | Windmill".
      await expect(page).toHaveTitle(/Assets \| Windmill/i, { timeout: 30_000 })

      // PageHeader renders the title in an h1 (PageHeader.svelte).
      await expect(page.getByRole('heading', { name: 'Assets', level: 1 })).toBeVisible({
        timeout: 30_000,
      })

      // Section labels above the two regions.
      await expect(page.getByText('All workspace assets', { exact: true })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText('Latest assets used', { exact: true })).toBeVisible({
        timeout: 30_000,
      })

      // The "All workspace assets" Section renders one card per built-in asset
      // kind shipped on CE: Data table, Ducklake, Object storage.
      // (Volumes is folded into the Object storage card via the itemExtra
      // snippet.)
      await expect(page.getByText('Data table', { exact: true })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('Ducklake', { exact: true })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('Object storage', { exact: true })).toBeVisible({
        timeout: 15_000,
      })

      // Our resource row should appear in the Latest assets DataTable. The
      // path cell is wrapped in `truncate(asset.path, 92)`; our slugs are
      // < 92 chars so the literal path renders.
      const resourceCell = page.getByText(resPath, { exact: false }).first()
      await expect(resourceCell).toBeVisible({ timeout: 30_000 })

      // Each row's "usages" cell renders `<n> usage(s)` as an anchor that
      // opens the AssetsUsageDrawer; we deployed exactly one script that
      // references the resource so the cell reads "1 usage".
      await expect(page.getByRole('link', { name: '1 usage' }).first()).toBeVisible({
        timeout: 15_000,
      })
    } finally {
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await deleteResource(request, auth, resPath).catch(() => {})
    }
  })
})
