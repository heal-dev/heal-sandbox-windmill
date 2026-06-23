import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, API_BASE, SEED } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi } from '../../helpers/scriptsApi'
import { deleteScheduleViaApi } from '../../helpers/schedulesApi'

const wid = SEED.workspace.id

test.describe('@flow @feature:schedules @worker SC03 — Create schedule from /schedules', () => {
  test('Open the schedule editor from /schedules, pick a script, save, and see the row', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `sc03-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const scriptPath = `u/admin/${slug}`
    // Path-name is just the leaf; the editor's prefix selector (default
    // `u/admin@windmill.dev`) joins it with the chosen folder.
    const scheduleLeaf = slug
    let createdSchedulePath = ''

    await createScriptViaApi(request, auth, {
      path: scriptPath,
      language: 'python3',
      content: "def main():\n    return 'hello windmill'\n",
      summary: `SC03 ${slug}`,
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

      // Fill the schedule path-name (placeholder "schedule" per the spec).
      const pathField = page
        .getByRole('textbox', { name: /^schedule$/i })
        .or(page.getByPlaceholder(/^schedule$/))
        .first()
      await pathField.fill(scheduleLeaf)

      // Cron field — accessible name is "Cron".
      const cronField = page.getByRole('textbox', { name: 'Cron' })
      await cronField.fill('0 9 * * *')

      // Pick the deployed script via the "Pick a script" picker.
      const pickerTrigger = page
        .getByRole('textbox', { name: /Pick a script/i })
        .or(page.getByPlaceholder(/Pick a script/i))
        .first()
      await pickerTrigger.click()
      await pickerTrigger.fill(slug)
      // The picker surfaces matching results as menu/list items — click the
      // first match referencing our script path.
      const candidate = page
        .getByRole('option', { name: new RegExp(slug, 'i') })
        .or(page.getByRole('menuitem', { name: new RegExp(slug, 'i') }))
        .or(page.getByText(new RegExp(slug, 'i')))
        .first()
      await candidate.click()

      // Save the schedule via the Save button.
      await page.getByRole('button', { name: /^Save$/ }).first().dispatchEvent('click')

      // Poll the backend until the schedule shows up — the editor may take a
      // moment to close + the list to refresh.
      const candidatePaths = [
        `u/admin/${scheduleLeaf}`,
        `u/admin@windmill.dev/${scheduleLeaf}`,
      ]
      await expect.poll(async () => {
        const res = await request.get(`${API_BASE}/w/${wid}/schedules/list`, {
          headers: { Cookie: auth.cookie },
        })
        if (!res.ok()) return ''
        const items = (await res.json()) as Array<{ path: string }>
        const hit = items.find((s) => candidatePaths.includes(s.path) || s.path.endsWith(`/${scheduleLeaf}`))
        return hit?.path ?? ''
      }, { timeout: 30_000 }).not.toBe('')

      const listRes = await request.get(`${API_BASE}/w/${wid}/schedules/list`, {
        headers: { Cookie: auth.cookie },
      })
      const items = (await listRes.json()) as Array<{ path: string }>
      createdSchedulePath =
        items.find((s) => candidatePaths.includes(s.path) || s.path.endsWith(`/${scheduleLeaf}`))?.path ?? ''

      // UI assertion: the row appears on /schedules.
      await page.goto(`${FRONTEND_URL}/schedules`)
      await expect(page.getByText(new RegExp(`schedule:\\s*.*${scheduleLeaf}`)).first()).toBeVisible({
        timeout: 30_000,
      })
    } finally {
      if (createdSchedulePath) {
        await deleteScheduleViaApi(request, auth, createdSchedulePath).catch(() => {})
      }
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
