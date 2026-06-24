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

test.describe('@flow @feature:schedules @worker SC05 — Edit schedule cron', () => {
  test('Change the cron via the row Edit affordance and see the new value', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `sc05-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`
    const schedulePath = `u/admin/${slug}`
    // Windmill's Cron field defaults to v1 (6-field, seconds-first). The
    // editor input rejects 5-field crons silently, so we type 6-field.
    const oldCron = '0 * * * * *'
    const newCron = '0 */5 * * * *'

    try {
      // Defensive: clear any leftover at the target paths from a prior failed run.
      await tryDeleteScheduleViaApi(request, auth, schedulePath)
      await tryDeleteScriptViaApi(request, auth, scriptPath)

      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    # ns: ${slug}\n    return 'hello windmill'\n`,
        summary: `SC05 ${slug}`,
      })
      await createScheduleViaApi(request, auth, {
        path: schedulePath,
        scriptPath,
        schedule: oldCron,
        timezone: 'UTC',
        enabled: true,
        summary: `SC05 ${slug}`,
      })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/schedules`)
      await expect(page.getByRole('heading', { name: /^Schedules$/i })).toBeVisible({
        timeout: 30_000,
      })

      const rowLabel = page.getByText(`schedule: ${schedulePath}`).first()
      await expect(rowLabel).toBeVisible({ timeout: 30_000 })
      const row = rowLabel.locator('xpath=ancestor::div[contains(@class, "bg-surface-tertiary")][1]')

      // Click the row-scoped Edit button (per +page.svelte: a Button with text
      // "Edit" when canWrite). The row also exposes Edit via the dropdown.
      await row.getByRole('button', { name: /^Edit$/ }).first().click()

      await expect(
        page.getByRole('heading', { name: /^Schedule$/, level: 2 }).first(),
      ).toBeVisible({ timeout: 15_000 })

      const cronField = page.getByRole('textbox', { name: 'Cron' })
      await expect(cronField).toBeVisible({ timeout: 15_000 })
      await cronField.fill('')
      await cronField.fill(newCron)

      await page.getByRole('button', { name: /^Save$/ }).first().dispatchEvent('click')

      // Backend confirmation: GET /schedules/get/<path> returns the new cron.
      await expect.poll(async () => {
        const res = await request.get(
          `${API_BASE}/w/${wid}/schedules/get/${schedulePath}`,
          { headers: { Cookie: auth.cookie } },
        )
        if (!res.ok()) return ''
        return ((await res.json()) as { schedule: string }).schedule
      }, { timeout: 30_000 }).toBe(newCron)

      // UI assertion: the row now displays the updated cron.
      await page.goto(`${FRONTEND_URL}/schedules`)
      const refreshedRow = page
        .getByText(`schedule: ${schedulePath}`)
        .first()
        .locator('xpath=ancestor::div[contains(@class, "bg-surface-tertiary")][1]')
      await expect(refreshedRow.getByText(newCron).first()).toBeVisible({ timeout: 30_000 })
    } finally {
      await deleteScheduleViaApi(request, auth, schedulePath).catch(() => {})
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
