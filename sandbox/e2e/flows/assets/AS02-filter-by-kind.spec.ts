import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createResource, deleteResource } from '../../helpers/varResApi'
import { createScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import { listAssetsViaApi } from '../../helpers/assetsApi'

test.describe('@flow @feature:assets @worker AS02 — Filter assets by kind', () => {
  test('?asset_kinds=resource shows resource rows; ?asset_kinds=variable hides them', async ({
    page,
    request,
    fx,
  }) => {
    const slug = `as02-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32)
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
        summary: 'assets AS02',
      })

      // API precondition: the resource is listed AND survives ?asset_kinds=resource,
      // AND is gone when ?asset_kinds=variable (since the parser does not emit
      // a variable asset for wmill.get_variable — verified during walk).
      const onlyResources = await listAssetsViaApi(request, auth, { assetKinds: 'resource' })
      expect(
        onlyResources.assets.some((a) => a.kind === 'resource' && a.path === resPath),
        'resource should appear when filtered by kind=resource',
      ).toBe(true)
      expect(
        onlyResources.assets.every((a) => a.kind === 'resource'),
        'every row returned must be kind=resource',
      ).toBe(true)

      const onlyVariables = await listAssetsViaApi(request, auth, { assetKinds: 'variable' })
      expect(
        onlyVariables.assets.every((a) => a.kind === 'variable'),
        'every row returned must be kind=variable (often zero on CE)',
      ).toBe(true)
      expect(
        onlyVariables.assets.some((a) => a.path === resPath),
        'resource path must NOT show up under kind=variable',
      ).toBe(false)

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))

      // === Positive: kind=resource ===
      // The /assets page builds its filters from useUrlSyncedFilterInstance,
      // which round-trips ?asset_kinds=<csv> straight into the
      // AssetService.listAssets() query.
      await page.goto(`${FRONTEND_URL}/assets?asset_kinds=resource`)
      await expect(page.getByRole('heading', { name: 'Assets', level: 1 })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText(resPath, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      })
      // formatAssetKind() renders a human-readable label beneath the path.
      // For a `resource`-kind asset whose metadata.resource_type === 'postgresql'
      // the label is the literal 'Postgresql resource' (see
      // frontend/src/lib/components/assets/lib.ts L74-87:
      // `${capitalize(asset.metadata.resource_type)} resource`).
      await expect(page.getByText('Postgresql resource', { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      })

      // === Negative: kind=variable -> our resource must vanish ===
      await page.goto(`${FRONTEND_URL}/assets?asset_kinds=variable`)
      await expect(page.getByRole('heading', { name: 'Assets', level: 1 })).toBeVisible({
        timeout: 30_000,
      })
      // The DataTable empty-state row reads exactly 'No assets found'
      // (assets/+page.svelte L370). On the sandbox stack the parser never
      // emits any variable asset rows, so kind=variable always renders the
      // empty state.
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
