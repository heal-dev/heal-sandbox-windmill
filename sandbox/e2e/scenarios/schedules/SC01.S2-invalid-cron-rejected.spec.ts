import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, API_BASE, SEED } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi } from '../../helpers/scriptsApi'
import { deleteScheduleViaApi } from '../../helpers/schedulesApi'

const wid = SEED.workspace.id

test.describe('@scenario @feature:schedules @worker SC01.S2 — Invalid cron rejected', () => {
  test('Saving an invalid cron does not create a schedule', async ({ page, request, fx }) => {
    const auth = await loginAdmin(request)
    const slug = `sc01s2-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`
    const scheduleLeaf = slug

    await createScriptViaApi(request, auth, {
      path: scriptPath,
      language: 'python3',
      content: "def main():\n    return 'hello windmill'\n",
      summary: `SC01.S2 ${slug}`,
    })

    try {
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/schedules`)
      await expect(page.getByRole('heading', { name: /^Schedules$/i })).toBeVisible({
        timeout: 30_000,
      })

      await page.getByRole('button', { name: /^New schedule$/ }).click()
      await expect(
        page.getByRole('heading', { name: /^Schedule$/, level: 2 }).first(),
      ).toBeVisible({ timeout: 15_000 })

      // Fill the schedule path-name.
      const pathField = page
        .getByRole('textbox', { name: /^schedule$/i })
        .or(page.getByPlaceholder(/^schedule$/))
        .first()
      await pathField.fill(scheduleLeaf)

      // Pick the deployed script.
      const pickerTrigger = page
        .getByRole('textbox', { name: /Pick a script/i })
        .or(page.getByPlaceholder(/Pick a script/i))
        .first()
      await pickerTrigger.click()
      await pickerTrigger.fill(slug)
      await page
        .getByRole('option', { name: new RegExp(slug, 'i') })
        .or(page.getByRole('menuitem', { name: new RegExp(slug, 'i') }))
        .or(page.getByText(new RegExp(slug, 'i')))
        .first()
        .click()

      // Fill the Cron with an obviously invalid value.
      const cronField = page.getByRole('textbox', { name: 'Cron' })
      await cronField.fill('')
      await cronField.fill('not a cron')

      // Attempt to save — Windmill either disables Save, surfaces an inline
      // error, or the POST returns 4xx. Either way, the schedule must not
      // appear in the backend list.
      const saveBtn = page.getByRole('button', { name: /^Save$/ }).first()
      // Best-effort click; ignore if disabled / overlay-blocked.
      await saveBtn.dispatchEvent('click').catch(() => {})

      // Give the page a moment to attempt the save (or surface validation).
      await page.waitForTimeout(2_000)

      // Backend assertion: no schedule was created for this path.
      const candidatePaths = [
        `u/admin/${scheduleLeaf}`,
        `u/admin@windmill.dev/${scheduleLeaf}`,
      ]
      const listRes = await request.get(`${API_BASE}/w/${wid}/schedules/list`, {
        headers: { Cookie: auth.cookie },
      })
      const items = (await listRes.json()) as Array<{ path: string }>
      const created = items.find(
        (s) => candidatePaths.includes(s.path) || s.path.endsWith(`/${scheduleLeaf}`),
      )
      expect(created, 'no schedule should be persisted for an invalid cron').toBeUndefined()
    } finally {
      // Defensive cleanup — in case a schedule somehow slipped through.
      await deleteScheduleViaApi(request, auth, `u/admin/${scheduleLeaf}`).catch(() => {})
      await deleteScheduleViaApi(request, auth, `u/admin@windmill.dev/${scheduleLeaf}`).catch(
        () => {},
      )
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
