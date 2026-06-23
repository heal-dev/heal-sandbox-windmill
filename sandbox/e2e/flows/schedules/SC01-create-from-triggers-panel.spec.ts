import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, API_BASE, SEED } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi } from '../../helpers/scriptsApi'
import { deleteScheduleViaApi } from '../../helpers/schedulesApi'

const wid = SEED.workspace.id

test.describe('@flow @feature:schedules @worker SC01 — Create schedule from Triggers panel', () => {
  test('Add a Schedule trigger from a deployed script and see it attached', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `sc01-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`
    const expectedSchedulePath = scriptPath // schedule auto-derives its path from the script
    let scheduleCreatedPath = ''

    await createScriptViaApi(request, auth, {
      path: scriptPath,
      language: 'python3',
      content: "def main():\n    return 'hello windmill'\n",
      summary: `SC01 ${slug}`,
    })

    try {
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/scripts/get/${scriptPath}`)
      await page.waitForURL(/\/scripts\/get\//, { timeout: 60_000 })

      // Switch to the Triggers tab in the script-detail right panel. The page
      // has multiple "Triggers" buttons (sidebar + tab); anchor on the
      // Inputs-library tab's parent so we click the detail-panel sibling.
      const detailTabBar = page
        .getByRole('button', { name: /^Inputs library$/ })
        .locator('..')
      await detailTabBar.getByRole('button', { name: /^Triggers$/ }).click()

      await page.getByRole('button', { name: /^Add trigger$/ }).first().click()
      await page.getByRole('menuitem', { name: /^Schedule$/ }).first().click()
      await expect(
        page.getByRole('heading', { name: /^Schedule$/, level: 2 }).first(),
      ).toBeVisible({ timeout: 15_000 })

      const cronField = page.getByRole('textbox', { name: 'Cron' })
      await cronField.fill('* * * * *')

      // Current Windmill UI persists the schedule as a script-attached draft and
      // publishes it via the script's Deploy button (see journey reference).
      await page.getByRole('button', { name: /^Deploy$/ }).dispatchEvent('click')

      // Poll the API for a schedule whose script_path matches our deployed
      // script — the row will surface on /schedules once persisted.
      await expect.poll(async () => {
        const res = await request.get(`${API_BASE}/w/${wid}/schedules/list`, {
          headers: { Cookie: auth.cookie },
        })
        if (!res.ok()) return ''
        const items = (await res.json()) as Array<{ path: string; script_path: string }>
        const hit = items.find((s) => s.script_path === scriptPath)
        return hit?.path ?? ''
      }, { timeout: 30_000 }).not.toBe('')

      // Capture the path for cleanup.
      const listRes = await request.get(`${API_BASE}/w/${wid}/schedules/list`, {
        headers: { Cookie: auth.cookie },
      })
      const items = (await listRes.json()) as Array<{ path: string; script_path: string }>
      scheduleCreatedPath = items.find((s) => s.script_path === scriptPath)?.path ?? ''

      // UI assertion: navigate to /schedules and confirm a row with the cron is visible.
      await page.goto(`${FRONTEND_URL}/schedules`)
      await expect(page.getByRole('heading', { name: /^Schedules$/i })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText('* * * * *').first()).toBeVisible({ timeout: 30_000 })
    } finally {
      if (scheduleCreatedPath) {
        await deleteScheduleViaApi(request, auth, scheduleCreatedPath).catch(() => {})
      } else {
        // Best-effort fallback in case the schedule was created at the script path.
        await deleteScheduleViaApi(request, auth, expectedSchedulePath).catch(() => {})
      }
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
