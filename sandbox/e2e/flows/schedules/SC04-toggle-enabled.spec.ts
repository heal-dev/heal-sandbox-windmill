import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, API_BASE, SEED } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi } from '../../helpers/scriptsApi'
import { createScheduleViaApi, deleteScheduleViaApi } from '../../helpers/schedulesApi'

const wid = SEED.workspace.id

test.describe('@flow @feature:schedules @worker SC04 — Toggle schedule enabled state', () => {
  test('Flip the row toggle off then on; backend state mirrors the UI', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `sc04-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`
    const schedulePath = `u/admin/${slug}`

    await createScriptViaApi(request, auth, {
      path: scriptPath,
      language: 'python3',
      content: `def main():\n    # ns: ${slug}\n    return 'hello windmill'\n`,
      summary: `SC04 ${slug}`,
    })
    await createScheduleViaApi(request, auth, {
      path: schedulePath,
      scriptPath,
      schedule: '* * * * *',
      timezone: 'UTC',
      enabled: true,
      summary: `SC04 ${slug}`,
    })

    try {
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/schedules`)
      await expect(page.getByRole('heading', { name: /^Schedules$/i })).toBeVisible({
        timeout: 30_000,
      })

      // Anchor on the unique `schedule: <path>` text inside the row, then walk
      // up to the row container and grab the row-scoped Toggle (role=switch).
      const rowLabel = page.getByText(`schedule: ${schedulePath}`).first()
      await expect(rowLabel).toBeVisible({ timeout: 30_000 })
      const row = rowLabel.locator('xpath=ancestor::div[contains(@class, "bg-surface-tertiary")][1]')
      const toggle = row.getByRole('switch').first()

      // Disable.
      await expect(toggle).toBeChecked({ timeout: 15_000 })
      await toggle.click()
      await expect.poll(async () => {
        const res = await request.get(
          `${API_BASE}/w/${wid}/schedules/get/${schedulePath}`,
          { headers: { Cookie: auth.cookie } },
        )
        if (!res.ok()) return null
        return ((await res.json()) as { enabled: boolean }).enabled
      }, { timeout: 30_000 }).toBe(false)
      await expect(toggle).not.toBeChecked({ timeout: 15_000 })

      // Re-enable.
      await toggle.click()
      await expect.poll(async () => {
        const res = await request.get(
          `${API_BASE}/w/${wid}/schedules/get/${schedulePath}`,
          { headers: { Cookie: auth.cookie } },
        )
        if (!res.ok()) return null
        return ((await res.json()) as { enabled: boolean }).enabled
      }, { timeout: 30_000 }).toBe(true)
      await expect(toggle).toBeChecked({ timeout: 15_000 })
    } finally {
      await deleteScheduleViaApi(request, auth, schedulePath).catch(() => {})
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
