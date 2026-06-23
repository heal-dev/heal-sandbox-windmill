import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi } from '../../helpers/scriptsApi'
import { createScheduleViaApi, deleteScheduleViaApi } from '../../helpers/schedulesApi'

test.describe('@flow @feature:schedules @worker SC02 — Schedule appears on /schedules', () => {
  test('A schedule created via API shows up on the /schedules list', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `sc02-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`
    const schedulePath = `u/admin/${slug}`
    const cron = '* * * * *'

    await createScriptViaApi(request, auth, {
      path: scriptPath,
      language: 'python3',
      content: `def main():\n    # ns: ${slug}\n    return 'hello windmill'\n`,
      summary: `SC02 ${slug}`,
    })
    await createScheduleViaApi(request, auth, {
      path: schedulePath,
      scriptPath,
      schedule: cron,
      timezone: 'UTC',
      summary: `SC02 ${slug}`,
    })

    try {
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/schedules`)

      await expect(page.getByRole('heading', { name: /^Schedules$/i })).toBeVisible({
        timeout: 30_000,
      })

      // The row renders `schedule: <path>` plus the cron in a blue badge.
      await expect(page.getByText(`schedule: ${schedulePath}`).first()).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText(cron).first()).toBeVisible({ timeout: 30_000 })
    } finally {
      await deleteScheduleViaApi(request, auth, schedulePath).catch(() => {})
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
