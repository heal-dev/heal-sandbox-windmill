import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, API_BASE } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'

test.describe('@flow @feature:workers @worker WK01 — View workers list', () => {
  test('PageHeader "Workers" + worker-group tabs + at least one Alive row', async ({
    page,
    request,
  }) => {
    const auth = await loginAdmin(request)

    // API precondition: workers/list returns at least one worker. The Workers
    // page polls WorkerService.listWorkers({ perPage: 1000, pingSince: 300 })
    // every 5s on mount; if the live stack has zero workers, the page renders
    // 'No workers seem to be available' instead of the table.
    const apiRes = await request.get(`${API_BASE}/workers/list?per_page=1000&ping_since=300`, {
      headers: { Cookie: auth.cookie },
    })
    expect(apiRes.status(), 'workers/list precondition').toBe(200)
    const workers = (await apiRes.json()) as Array<{ worker: string; worker_group: string }>
    expect(workers.length, 'live stack must have at least one worker').toBeGreaterThan(0)

    await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
    await page.goto(`${FRONTEND_URL}/workers`)

    // +page.js sets `stuff: { title: 'Workers' }` -> document title "Workers | Windmill"
    await expect(page).toHaveTitle(/Workers/i, { timeout: 30_000 })

    // PageHeader renders title in an h1 (PageHeader.svelte L27).
    await expect(page.getByRole('heading', { name: /^Workers$/, level: 1 })).toBeVisible({
      timeout: 30_000,
    })

    // The two well-known worker groups in the sandbox stack are 'default' and 'native'.
    // They render as Tabs ({#each groupedWorkers as name}); the Tab snippet `extra`
    // appends a worker count, so the accessible name is e.g. "default 3 workers".
    await expect(page.getByRole('button', { name: /^default\s+\d+\s+workers?$/i }).first()).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole('button', { name: /^native\s+\d+\s+workers?$/i }).first()).toBeVisible({
      timeout: 30_000,
    })

    // Section heading 'Active workers' (rendered as plain text in the workers/+page.svelte L944)
    await expect(page.getByText('Active workers', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    })

    // At least one row in the DataTable has the green 'Alive' Badge — pings within 60s
    // are flagged isWorkerAlive=true and render Status text 'Alive'. We assert the
    // visible badge text rather than the row count (number of workers varies by stack).
    await expect(page.getByText('Alive', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    })
  })
})
