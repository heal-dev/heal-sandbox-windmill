import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, API_BASE, SEED } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi } from '../../helpers/scriptsApi'
import { createScheduleViaApi, deleteScheduleViaApi } from '../../helpers/schedulesApi'

const wid = SEED.workspace.id

test.describe('@flow @feature:schedules @worker SC07 — Run now from a schedule row', () => {
  test('Run now enqueues an immediate job that shows up in /runs', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `sc07-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`
    const schedulePath = `u/admin/${slug}`

    await createScriptViaApi(request, auth, {
      path: scriptPath,
      language: 'python3',
      content: `def main():\n    # ns: ${slug}\n    return 'hello windmill'\n`,
      summary: `SC07 ${slug}`,
    })
    // Create the schedule disabled so the cron itself does NOT fire — the only
    // job in /runs for this script should be the on-demand "Run now" one.
    await createScheduleViaApi(request, auth, {
      path: schedulePath,
      scriptPath,
      schedule: '0 0 1 1 *', // once a year — effectively never within this test
      timezone: 'UTC',
      enabled: false,
      summary: `SC07 ${slug}`,
    })

    try {
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/schedules`)
      await expect(page.getByRole('heading', { name: /^Schedules$/i })).toBeVisible({
        timeout: 30_000,
      })

      // Show "All" (including disabled) — page defaults may filter to enabled.
      const allFilter = page.getByRole('button', { name: /^All$/ }).first()
      if (await allFilter.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await allFilter.click().catch(() => {})
      }

      const rowLabel = page.getByText(`schedule: ${schedulePath}`).first()
      await expect(rowLabel).toBeVisible({ timeout: 30_000 })
      const row = rowLabel.locator('xpath=ancestor::div[contains(@class, "bg-surface-tertiary")][1]')

      const kebab = row.getByRole('button').last()
      await kebab.click()
      await page
        .getByRole('menuitem', { name: /^Run now$/ })
        .first()
        .click()

      // Backend confirmation: poll /jobs/list for a job whose script_path
      // matches ours. This is more reliable than the runs-page rendering.
      await expect.poll(async () => {
        const res = await request.get(
          `${API_BASE}/w/${wid}/jobs/list?script_path_exact=${scriptPath}`,
          { headers: { Cookie: auth.cookie } },
        )
        if (!res.ok()) return 0
        const items = (await res.json()) as Array<{ script_path?: string }>
        return items.length
      }, { timeout: 30_000 }).toBeGreaterThan(0)

      // UI assertion: a row in /runs exists for our script.
      await page.goto(`${FRONTEND_URL}/runs/?script_path=${scriptPath}`)
      await expect(page.getByRole('heading', { name: /^Runs$/i })).toBeVisible({
        timeout: 30_000,
      })
      await expect(
        page.getByRole('link', { name: /See run detail/i }).first(),
      ).toBeVisible({ timeout: 60_000 })
    } finally {
      await deleteScheduleViaApi(request, auth, schedulePath).catch(() => {})
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
