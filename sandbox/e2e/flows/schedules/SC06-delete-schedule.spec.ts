import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, API_BASE, SEED } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import {
  createScheduleViaApi,
  deleteScheduleViaApi,
  tryDeleteScheduleViaApi,
} from '../../helpers/schedulesApi'

const wid = SEED.workspace.id

test.describe('@flow @feature:schedules @worker SC06 — Delete a schedule', () => {
  test('Delete from the row dropdown removes the schedule row', async ({ page, request, fx }) => {
    const auth = await loginAdmin(request)
    const slug = `sc06-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`
    const schedulePath = `u/admin/${slug}`

    try {
      // Defensive: clear any leftover at the target paths from a prior failed run.
      await tryDeleteScheduleViaApi(request, auth, schedulePath)
      await tryDeleteScriptViaApi(request, auth, scriptPath)

      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    # ns: ${slug}\n    return 'hello windmill'\n`,
        summary: `SC06 ${slug}`,
      })
      await createScheduleViaApi(request, auth, {
        path: schedulePath,
        scriptPath,
        schedule: '* * * * *',
        timezone: 'UTC',
        enabled: true,
        summary: `SC06 ${slug}`,
      })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/schedules`)
      await expect(page.getByRole('heading', { name: /^Schedules$/i })).toBeVisible({
        timeout: 30_000,
      })

      const rowLabel = page.getByText(`schedule: ${schedulePath}`).first()
      await expect(rowLabel).toBeVisible({ timeout: 30_000 })
      const row = rowLabel.locator('xpath=ancestor::div[contains(@class, "bg-surface-tertiary")][1]')

      // Open the row's kebab dropdown — it's the trailing icon-button without
      // a text label, so scope to the row and pick the last button.
      const kebab = row.getByRole('button').last()
      await kebab.click()

      // Click "Delete" in the opened menu. Windmill's Dropdown surfaces items
      // as menuitems; pick the Delete one (destructive variant).
      await page
        .getByRole('menuitem', { name: /^Delete$/ })
        .first()
        .click()

      // Some Windmill destructive dropdown items pop a confirm step — if a
      // confirm button is visible, accept it. Otherwise this is a no-op.
      const confirmBtn = page
        .getByRole('button', { name: /^(Delete|Confirm|Yes)$/i })
        .first()
      if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmBtn.click().catch(() => {})
      }

      // Backend confirmation: schedule is gone (GET returns non-200 / list
      // omits the path).
      await expect.poll(async () => {
        const res = await request.get(`${API_BASE}/w/${wid}/schedules/list`, {
          headers: { Cookie: auth.cookie },
        })
        if (!res.ok()) return 'list-failed'
        const items = (await res.json()) as Array<{ path: string }>
        return items.some((s) => s.path === schedulePath) ? 'present' : 'absent'
      }, { timeout: 30_000 }).toBe('absent')

      // UI assertion: the row label is no longer on the page after a refresh.
      await page.goto(`${FRONTEND_URL}/schedules`)
      await expect(page.getByText(`schedule: ${schedulePath}`)).toHaveCount(0, {
        timeout: 30_000,
      })
    } finally {
      // No schedule cleanup needed — the test deleted it. Best-effort fallback
      // in case the UI delete failed mid-way.
      await deleteScheduleViaApi(request, auth, schedulePath).catch(() => {})
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
