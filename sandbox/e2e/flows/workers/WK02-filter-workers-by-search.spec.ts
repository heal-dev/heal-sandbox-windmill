import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, API_BASE } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'

test.describe('@flow @feature:workers @worker WK02 — Filter workers via search input', () => {
  test('Typing into the group search box narrows the visible rows', async ({ page, request }) => {
    const auth = await loginAdmin(request)

    // API precondition: ensure there is at least one worker in the 'default' group.
    // filterWorkerGroupByNames (workers/+page.svelte L527) matches on
    // worker.name | worker_instance | ip — `wk-default` is the prefix every
    // worker in the default group starts with on the sandbox stack.
    const apiRes = await request.get(`${API_BASE}/workers/list?per_page=1000&ping_since=300`, {
      headers: { Cookie: auth.cookie },
    })
    expect(apiRes.status()).toBe(200)
    const workers = (await apiRes.json()) as Array<{ worker: string; worker_group: string }>
    const defaultWorkers = workers.filter((w) => w.worker_group === 'default')
    expect(
      defaultWorkers.length,
      "sandbox stack must have at least one worker in the 'default' group",
    ).toBeGreaterThan(0)

    await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
    await page.goto(`${FRONTEND_URL}/workers`)

    // Wait for the page header before interacting — the table only mounts once
    // the first loadWorkers() poll has populated.
    await expect(page.getByRole('heading', { name: /^Workers$/, level: 1 })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText('Active workers', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    })

    // The default group is selected by default (selectedTab = 'default'); search
    // input placeholder is "Search workers in group 'default'" (workers/+page.svelte L948).
    const searchBox = page.getByPlaceholder("Search workers in group 'default'").first()
    await expect(searchBox).toBeVisible({ timeout: 30_000 })

    // Positive match: every default-group worker name starts with 'wk-default'.
    await searchBox.fill('wk-default')
    await expect(page.getByText(/wk-default/).first()).toBeVisible({ timeout: 15_000 })

    // Negative match: a search that cannot match any worker triggers the
    // empty-state copy 'No active workers found matching the search query'
    // (workers/+page.svelte L1250).
    await searchBox.fill('no-such-worker-zzz')
    await expect(
      page.getByText('No active workers found matching the search query', { exact: true }),
    ).toBeVisible({ timeout: 15_000 })
  })
})
