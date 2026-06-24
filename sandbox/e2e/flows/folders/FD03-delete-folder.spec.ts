import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createFolderViaApi,
  deleteFolderViaApi,
  tryDeleteFolderViaApi,
  getFolderViaApi,
} from '../../helpers/foldersApi'

test.describe('@flow @feature:folders @worker FD03 — Delete a folder', () => {
  test('Open row kebab → Delete → row disappears + GET 404', async ({ page, request, fx }) => {
    const auth = await loginAdmin(request)
    const name = `fd03-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30)

    try {
      await tryDeleteFolderViaApi(request, auth, name)
      await createFolderViaApi(request, auth, { name })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/folders`)
      await expect(page.getByRole('heading', { name: /^Folders$/ })).toBeVisible({
        timeout: 30_000,
      })

      // Anchor on the Name cell text (visible only when the row exists).
      const nameCell = page.getByText(name, { exact: true }).first()
      await expect(nameCell).toBeVisible({ timeout: 15_000 })

      // Climb to the row container. The DataTable row is rendered by Row.svelte
      // as <tr>; the nameCell is in a <td> child. xpath ancestor::tr[1] is the
      // unambiguous walk-up.
      const row = nameCell.locator('xpath=ancestor::tr[1]')

      // The kebab/dropdown is the last unnamed button in the row's action cell.
      // shouldStopPropagation prevents the row's on:click from opening the
      // drawer when we click the kebab — see folders/+page.svelte L209.
      const kebabCandidates = [
        row.locator('button:has(svg.lucide-ellipsis-vertical)'),
        row.locator('button:has(svg.lucide-more-vertical)'),
        row.locator('button[aria-haspopup="menu"]'),
        row.getByRole('button').last(),
      ]

      let opened = false
      for (const cand of kebabCandidates) {
        const first = cand.first()
        if (await first.isVisible().catch(() => false)) {
          await first.click({ timeout: 5000 }).catch(() => {})
          if (
            await page
              .getByRole('menuitem', { name: /^Delete/i })
              .or(page.getByText(/^Delete$/i).first())
              .first()
              .isVisible({ timeout: 1500 })
              .catch(() => false)
          ) {
            opened = true
            break
          }
        }
      }
      expect(opened, 'kebab dropdown should open for the folder row').toBe(true)

      // Auto-accept any confirm() dialog the Delete action raises.
      page.on('dialog', (d) => {
        d.accept().catch(() => {})
      })

      await page
        .getByRole('menuitem', { name: /^Delete/i })
        .or(page.getByText(/^Delete$/i).first())
        .first()
        .click()

      // Verify deletion via API — authoritative.
      await expect
        .poll(
          async () => (await getFolderViaApi(request, auth, name)).status,
          { timeout: 30_000 },
        )
        .toBe(404)

      // The row should disappear from the UI.
      await expect(page.getByText(name, { exact: true })).toHaveCount(0)
    } finally {
      await deleteFolderViaApi(request, auth, name).catch(() => {})
    }
  })
})
