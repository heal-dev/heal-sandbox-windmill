import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createFolderViaApi,
  deleteFolderViaApi,
  tryDeleteFolderViaApi,
  getFolderViaApi,
} from '../../helpers/foldersApi'

test.describe('@flow @feature:folders @worker FD02 — Add a group member to a folder', () => {
  test('Add g/all via the FolderEditor and verify it appears in the Permissions table', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const name = `fd02-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30)

    try {
      // Precondition via API: folder exists, no extra owners yet.
      await tryDeleteFolderViaApi(request, auth, name)
      await createFolderViaApi(request, auth, { name })

      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/folders`)
      await expect(page.getByRole('heading', { name: /^Folders$/ })).toBeVisible({
        timeout: 30_000,
      })

      // Click the row by its Name cell (Row is wired with on:click → opens drawer).
      await page.getByText(name, { exact: true }).first().click()

      // Drawer title 'Folder <name>' confirms the editor is open.
      await expect(page.getByText(`Folder ${name}`, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      })

      // Wait for FolderEditor to settle (Permissions label is the canonical
      // marker that the drawer's content rendered).
      await expect(page.getByText(/^Permissions \(\d+\)$/).first()).toBeVisible({
        timeout: 15_000,
      })

      // Switch the User|Group ToggleButtonGroup to 'Group'. The toggle is
      // a <button> rendered by ToggleButton.svelte. The sidebar 'Folders &
      // Groups' link has accessible name 'Folders & Groups' (loose match on
      // 'Group') and Playwright's hasText regex matches against textContent
      // which includes comment-node padding — `/^Group$/` returns 0 matches.
      // Locate by exact innerText via a JS predicate instead.
      const toggleHandle = await page.locator('button').evaluateAll((nodes) => {
        const idx = nodes.findIndex((n) => (n as HTMLElement).innerText.trim() === 'Group')
        return idx
      })
      expect(toggleHandle).toBeGreaterThanOrEqual(0)
      await page.locator('button').nth(toggleHandle).click()

      // Pick the group via the Select. Windmill's Select renders the input
      // with placeholder 'Please select'. The option dropdown is rendered in
      // a portal, so options live at page-root.
      const placeholder = page.locator('input[placeholder="Please select"]').first()
      await placeholder.click()
      await page.keyboard.type('all')
      await page
        .getByRole('option', { name: /^all$/ })
        .or(page.locator('[role="option"]', { hasText: /^all$/ }))
        .or(page.locator('li, button').filter({ hasText: /^all$/ }))
        .first()
        .click({ timeout: 5000 })
        .catch(async () => {
          // Fallback: press Enter on the filtered list.
          await page.keyboard.press('Enter')
        })

      // Click 'Grant' — only one button on the page has this text.
      await page.getByRole('button', { name: 'Grant', exact: true }).first().click()

      // Verify the membership via API. NOTE: the 'Grant' button in FolderEditor
      // calls GranularAclService.addGranularAcls (not /folders/addowner), so it
      // appears in extra_perms with role 'writer' (boolean true), NOT in the
      // owners array. The page section title becomes 'Permissions (2)' once the
      // grant lands.
      await expect
        .poll(
          async () => {
            const r = await getFolderViaApi(request, auth, name)
            const inOwners = r.body?.owners?.includes('g/all') ?? false
            const inExtra = Boolean(r.body?.extra_perms && 'g/all' in r.body.extra_perms)
            return inOwners || inExtra
          },
          { timeout: 30_000 },
        )
        .toBe(true)

      // UI: Permissions table now lists 'g/all'. The owner_name is rendered as
      // plain text in a <td> inside the drawer. Filter on <td> to avoid
      // matching e.g. an unrelated occurrence in the page.
      await expect(
        page.locator('td').filter({ hasText: /^g\/all$/ }).first(),
      ).toBeVisible({ timeout: 15_000 })
    } finally {
      await deleteFolderViaApi(request, auth, name).catch(() => {})
    }
  })
})
