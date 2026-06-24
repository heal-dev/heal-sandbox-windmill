import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createFolderViaApi,
  deleteFolderViaApi,
  tryDeleteFolderViaApi,
  getFolderUsageViaApi,
} from '../../helpers/foldersApi'
import {
  createScriptViaApi,
  deleteScriptViaApi,
  tryDeleteScriptViaApi,
} from '../../helpers/scriptsApi'

test.describe('@flow @feature:folders @worker FD04 — Script under f/<folder>/ is owned by the folder', () => {
  test('Folder usage reports the script and the /folders row shows 1 in Scripts', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const folder = `fd04-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30)
    const scriptPath = `f/${folder}/myscript`

    try {
      // Order matters: deleting the folder first leaves the script orphaned,
      // but deleting an orphaned script is still fine.
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await tryDeleteFolderViaApi(request, auth, folder)

      await createFolderViaApi(request, auth, { name: folder })
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    # ns: ${folder}\n    return 'hello-${folder}'\n`,
        summary: `FD04 ${folder}`,
      })

      // Backend usage endpoint reflects the script count.
      const usage = await getFolderUsageViaApi(request, auth, folder)
      expect(usage.scripts).toBeGreaterThanOrEqual(1)

      // UI: row's Scripts cell shows '1'.
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/folders`)
      await expect(page.getByRole('heading', { name: /^Folders$/ })).toBeVisible({
        timeout: 30_000,
      })

      const nameCell = page.getByText(folder, { exact: true }).first()
      await expect(nameCell).toBeVisible({ timeout: 15_000 })

      // Climb to <tr> and read Scripts cell. Columns (in order):
      //   Name | Labels | Scripts | Flows | Apps | Schedules | Variables | Resources | Participants | (kebab)
      // Scripts is the 3rd <td>.
      const row = nameCell.locator('xpath=ancestor::tr[1]')
      const scriptsCell = row.locator('td').nth(2)

      // FolderUsageInfo populates this asynchronously after mount.
      await expect.poll(
        async () => (await scriptsCell.innerText()).trim(),
        { timeout: 20_000 },
      ).toMatch(/^1$/)
    } finally {
      await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
      await deleteFolderViaApi(request, auth, folder).catch(() => {})
    }
  })
})
