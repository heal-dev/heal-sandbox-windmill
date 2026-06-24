import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, API_BASE } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'

test.describe('@flow @feature:workers @worker WK03 — Switch to the native worker group', () => {
  test('Clicking the "native" Tab swaps the visible group and lists native workers', async ({
    page,
    request,
  }) => {
    const auth = await loginAdmin(request)

    // API precondition: the 'native' worker group must exist (it's seeded on the
    // sandbox stack — see ConfigService.listWorkerGroups). nativets is one of
    // its canonical tags.
    const cfgRes = await request.get(`${API_BASE}/configs/list_worker_groups`, {
      headers: { Cookie: auth.cookie },
    })
    expect(cfgRes.status()).toBe(200)
    const groups = (await cfgRes.json()) as Array<{ name: string; config: { worker_tags?: string[] } }>
    expect(groups.find((g) => g.name === 'native'), "'native' worker group must exist").toBeDefined()

    // And the 'native' group must have at least one alive worker on the stack.
    const wRes = await request.get(`${API_BASE}/workers/list?per_page=1000&ping_since=300`, {
      headers: { Cookie: auth.cookie },
    })
    expect(wRes.status()).toBe(200)
    const workers = (await wRes.json()) as Array<{ worker: string; worker_group: string }>
    expect(
      workers.filter((w) => w.worker_group === 'native').length,
      "stack must have at least one worker in the 'native' group",
    ).toBeGreaterThan(0)

    await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
    await page.goto(`${FRONTEND_URL}/workers`)

    await expect(page.getByRole('heading', { name: /^Workers$/, level: 1 })).toBeVisible({
      timeout: 30_000,
    })

    // The 'native' tab is rendered as a <button> by the Tabs component; the
    // Tab snippet `extra` appends a pluralized worker count to its accessible name
    // (e.g. "native 8 workers").
    const nativeTab = page.getByRole('button', { name: /^native\s+\d+\s+workers?$/i }).first()
    await expect(nativeTab).toBeVisible({ timeout: 30_000 })
    await nativeTab.click()

    // After switching, the search placeholder reflects the active group (workers/+page.svelte L948).
    await expect(
      page.getByPlaceholder("Search workers in group 'native'").first(),
    ).toBeVisible({ timeout: 30_000 })

    // 'Active workers' subsection heading remains visible for the selected group.
    await expect(page.getByText('Active workers', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    })

    // At least one native worker row — names are prefixed 'wk-native' on the sandbox stack.
    await expect(page.getByText(/wk-native/).first()).toBeVisible({ timeout: 30_000 })
  })
})
