import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createResource, deleteResource } from '../../helpers/varResApi'
import { createScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import { listAssetsViaApi } from '../../helpers/assetsApi'

test.describe('@flow @feature:assets @worker AS03 — Filter assets by path pattern', () => {
  test('?asset_path matching narrows the table; non-matching path shows the empty state', async ({
    page,
    request,
    fx,
  }) => {
    const slug = `as03-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32)
    const resPath = `u/admin/${slug}`
    const scriptPath = `u/admin/${slug}_script`
    const auth = await loginAdmin(request)

    await tryDeleteScriptViaApi(request, auth, scriptPath)
    await deleteResource(request, auth, resPath).catch(() => {})
    try {
      await createResource(request, auth, resPath, 'postgresql', { host: 'h' })
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `import wmill\n\ndef main():\n    return wmill.get_resource("${resPath}")\n`,
        summary: 'assets AS03',
      })

      // API precondition: asset_path is server-side ILIKE %<query>%; the slug
      // is unique per test so the only match should be our resource.
      const hits = await listAssetsViaApi(request, auth, { assetPath: slug })
      expect(
        hits.assets.some((a) => a.kind === 'resource' && a.path === resPath),
        'asset_path filter must surface our resource via the API',
      ).toBe(true)

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))

      // === Positive: matching path ===
      await page.goto(`${FRONTEND_URL}/assets?asset_path=${encodeURIComponent(slug)}`)
      await expect(page.getByRole('heading', { name: 'Assets', level: 1 })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText(resPath, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      })

      // === Negative: a guaranteed-miss path ===
      // The slug includes a per-test ns, so 'no_such_asset_path_xyz_<ns>' is
      // unique and won't collide with anything else that landed in the table.
      const miss = `no_such_asset_path_xyz_${slug}`
      await page.goto(`${FRONTEND_URL}/assets?asset_path=${encodeURIComponent(miss)}`)
      await expect(page.getByRole('heading', { name: 'Assets', level: 1 })).toBeVisible({
        timeout: 30_000,
      })
      await expect(
        page.getByText('No assets found', { exact: true }),
      ).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(resPath, { exact: false })).toHaveCount(0, { timeout: 15_000 })
    } finally {
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await deleteResource(request, auth, resPath).catch(() => {})
    }
  })
})
