import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  tryDeleteFolderViaApi,
  deleteFolderViaApi,
  getFolderViaApi,
} from '../../helpers/foldersApi'

test.describe('@flow @feature:folders @worker FD01 — Create a folder', () => {
  test('Click "New folder", type a name, hit Create → drawer opens + row visible', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    // Folder name regex: ^[a-zA-Z_0-9-]+$ — fx.ns is already safe (w<idx>-t<hex>).
    const name = `fd01-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30)

    try {
      // Defensive: clear any leftover folder from a prior run.
      await tryDeleteFolderViaApi(request, auth, name)

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/folders`)
      await expect(page.getByRole('heading', { name: /^Folders$/ })).toBeVisible({
        timeout: 30_000,
      })

      // The 'New folder' button is the Popover trigger; clicking it reveals a
      // text input with placeholder 'New folder name' and a 'Create' button.
      await page.getByRole('button', { name: /^New folder$/i }).first().click()
      await page
        .locator('input[placeholder="New folder name"]')
        .first()
        .fill(name)

      // Click the popover 'Create' button (NOT the page-level 'New folder').
      await page.getByRole('button', { name: /^Create$/ }).first().click()

      // Verify creation via API first — drawer-open races a list-refresh.
      await expect
        .poll(
          async () => (await getFolderViaApi(request, auth, name)).status,
          { timeout: 30_000 },
        )
        .toBe(200)

      // FolderEditor drawer opens with title 'Folder <name>'.
      await expect(page.getByText(`Folder ${name}`, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      })

      // Close the drawer so the table is fully visible, then assert the row.
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)

      // The Name cell renders the folder name as text inside the row.
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      })
    } finally {
      await deleteFolderViaApi(request, auth, name).catch(() => {})
    }
  })
})
