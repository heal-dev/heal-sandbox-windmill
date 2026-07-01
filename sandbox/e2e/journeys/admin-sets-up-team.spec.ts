import { test, expect } from '../data/fixtures'
import { API_BASE, FRONTEND_URL } from '../../config'
import { loginAdmin } from '../helpers/workspaceApi'

// Journey: An admin stands up a fresh team workspace, invites a teammate,
// creates a group + folder, drops a folder-scoped variable to prove the ACL
// is wired, and verifies that audit-log activity surfaces (UI + API).
//
// Per the spec walkNotes:
//  - the 'admins' workspace blocks non-admin invites on CE, so the journey
//    intentionally creates a fresh team-<slug> workspace and runs all
//    subsequent mutations there.
//  - groups/adduser is api-shortcut (admin is auto-added as member).
//  - the folder-scoped variable seed is api-shortcut (audit-row generator).
//  - /audit_logs UI table renders 0 rows on CE-no-license — assert h1 +
//    EE-warning Alert in the UI and assert row-count > 0 via the API.
//
// All API calls in this test are scoped to the freshly-created team workspace
// (NOT the seeded 'admins' workspace).

test.describe('@journey @journey:admin-sets-up-team @worker admin-sets-up-team', () => {
  test.describe.configure({ mode: 'serial' })

  test('Admin stands up a team workspace, invites a teammate, adds group+folder, reviews audit logs', async ({
    page,
    request,
    fx,
  }, testInfo) => {
    testInfo.setTimeout(300_000)

    const slug = fx.ns.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 24)
    const teamWorkspaceId = `team-${slug}`.slice(0, 40)
    const teamWorkspaceName = `Team ${slug}`
    const inviteeEmail = `member-${slug}@example.com`
    const groupName = `team-group-${slug}`.slice(0, 50)
    const folderName = `team-folder-${slug}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50)
    const variablePath = `f/${folderName}/probe-${slug}`

    const auth = await loginAdmin(request)

    // Defensive: wipe any leftover workspace with this id before the walk
    // (idempotent — DELETE on a missing workspace is a no-op).
    await request
      .delete(`${API_BASE}/workspaces/delete/${teamWorkspaceId}`, {
        headers: { Cookie: auth.cookie },
      })
      .catch(() => {})

    try {
      // ===== Step 1: /user/workspaces — pick "+ Create a new workspace" =====
      await test.step('step 1: land on /user/workspaces and click Create-a-new-workspace', async () => {
        await page.goto(`${FRONTEND_URL}/user/workspaces`)
        await page.waitForLoadState('domcontentloaded')
        await expect(page.getByRole('heading', { name: 'Select a workspace' })).toBeVisible({
          timeout: 30_000,
        })
        await page.getByRole('link', { name: /\+\s*Create a new workspace/i }).first().click()
        await page.waitForURL(/\/user\/create_workspace/, { timeout: 30_000 })
      })

      // ===== Step 2: /user/create_workspace — fill + submit =====
      await test.step('step 2: fill workspace name + ID, click Create workspace', async () => {
        await expect(page.getByRole('heading', { name: /New Workspace/i })).toBeVisible({
          timeout: 15_000,
        })
        // Per walk: textboxes are unlabelled at the role layer; locate by label
        // text (the surrounding <label> is associated via for/id).
        await page.getByLabel(/Workspace name/i).fill(teamWorkspaceName)
        const idField = page.getByLabel(/Workspace ID/i)
        await idField.fill('')
        await idField.fill(teamWorkspaceId)
        await page.getByRole('button', { name: /^Create workspace$/i }).click()
        // Backend POST /api/workspaces/create returns 201; SPA navigates to /.
        await page.waitForURL(/\/(?:$|\?)/, { timeout: 60_000 })
      })

      // ===== Step 3: land on / (Workspace home) =====
      await test.step('step 3: land on Home with the new workspace selected', async () => {
        await expect(page.getByRole('heading', { name: /^Home$/i })).toBeVisible({ timeout: 30_000 })
        const ls = await page.evaluate(() => {
          try {
            return localStorage.getItem('workspace')
          } catch {
            return null
          }
        })
        expect(ls, 'localStorage.workspace is the new workspace id').toBe(teamWorkspaceId)
      })

      // ===== Step 4: /workspace_settings?tab=users — add a member =====
      await test.step('step 4: navigate to /workspace_settings?tab=users and add a member', async () => {
        await page.goto(`${FRONTEND_URL}/workspace_settings?tab=users`)
        await page.waitForLoadState('domcontentloaded')
        await expect(
          page.getByRole('heading', { name: new RegExp(`Workspace settings:\\s*${teamWorkspaceId}`) }),
        ).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: /^Members \(1\)$/ })).toBeVisible({
          timeout: 30_000,
        })

        await page.getByRole('button', { name: /^Add new user$/i }).first().click()

        // Per walk: the add-user "dialog" is inline; the new textbox after the
        // click has aria-label="email" and is the only such textbox.
        const emailInput = page.getByRole('textbox', { name: 'email' }).first()
        await expect(emailInput).toBeVisible({ timeout: 10_000 })
        await emailInput.fill(inviteeEmail)

        // Submit — walk found common labels: Add / Add user / Invite.
        // Try in priority order; the inline form sits next to the email input.
        const submitBtn = page
          .getByRole('button', { name: /^(Add user|Add|Invite|Send invite)$/i })
          .first()
        await submitBtn.click()

        // Members count jumps from 1 -> 2 (immediate add — no pending-invite step).
        await expect(page.getByRole('heading', { name: /^Members \(2\)$/ })).toBeVisible({
          timeout: 30_000,
        })
        await expect(page.getByText(inviteeEmail, { exact: false }).first()).toBeVisible({
          timeout: 15_000,
        })
      })

      // ===== Step 5: /groups — create a group via UI =====
      await test.step('step 5: navigate to /groups and create a group via UI', async () => {
        await page.goto(`${FRONTEND_URL}/groups`)
        await page.waitForLoadState('domcontentloaded')
        await expect(page.getByRole('heading', { name: /^Groups$/ })).toBeVisible({ timeout: 30_000 })

        await page.getByRole('button', { name: /^New group$/ }).first().click()

        // Popover input — aria-label 'New group name' per walk vocab.
        const groupInput = page
          .getByRole('textbox', { name: /New group name/i })
          .first()
          .or(page.locator('input[placeholder*="name" i]').last())
        await expect(groupInput).toBeVisible({ timeout: 10_000 })
        await groupInput.fill(groupName)

        await page.getByRole('button', { name: /^Create$/ }).first().click()

        // Wait for the row to render.
        await expect(page.getByText(groupName, { exact: false }).first()).toBeVisible({
          timeout: 20_000,
        })
      })

      // ===== Step 6: groups/adduser (API shortcut — admin is auto-added) =====
      // VERIFY: walk confirmed POST /groups/adduser/<group> with admin owner
      // returns 200 idempotently ("admin is already a member of group <name>").
      await test.step('step 6: VERIFY POST /groups/adduser/<group> is idempotent for admin owner', async () => {
        const res = await request.post(
          `${API_BASE}/w/${teamWorkspaceId}/groups/adduser/${groupName}`,
          {
            headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
            data: { username: 'admin' },
          },
        )
        expect(res.status(), `adduser status (body: ${(await res.text()).slice(0, 200)})`).toBe(200)
      })

      // ===== Step 7: /folders — create a folder via UI =====
      await test.step('step 7: navigate to /folders and create a folder via UI', async () => {
        await page.goto(`${FRONTEND_URL}/folders`)
        await page.waitForLoadState('domcontentloaded')
        await expect(page.getByRole('heading', { name: /^Folders$/ })).toBeVisible({ timeout: 30_000 })

        await page.getByRole('button', { name: /^New folder$/ }).first().click()

        // Popover input — aria-label 'New folder name' per walk vocab.
        const folderInput = page
          .getByRole('textbox', { name: /New folder name/i })
          .first()
          .or(page.locator('input[placeholder*="name" i]').last())
        await expect(folderInput).toBeVisible({ timeout: 10_000 })
        await folderInput.fill(folderName)

        await page.getByRole('button', { name: /^Create$/ }).first().click()

        // Row visible on the list — also the FolderEditor drawer opens in
        // place. Drawer title 'Folder <name>' renders as plain text per walk
        // (NOT role=heading), so assert via getByText.
        await expect(page.getByText(folderName, { exact: false }).first()).toBeVisible({
          timeout: 20_000,
        })
        await expect(
          page.getByText(new RegExp(`Folder\\s+${folderName}`)).first(),
        ).toBeVisible({ timeout: 15_000 })

        // Close the drawer so subsequent navigation isn't blocked.
        await page.keyboard.press('Escape').catch(() => {})
      })

      // ===== Step 8: API-shortcut — seed a folder-scoped variable =====
      // Per walk concession: this is an audit-row generator, not the
      // admin's headline mutation. Returns 201 with the variable path.
      await test.step('step 8: seed a folder-scoped variable via API (audit-row generator)', async () => {
        const res = await request.post(
          `${API_BASE}/w/${teamWorkspaceId}/variables/create`,
          {
            headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
            data: {
              path: variablePath,
              value: 'audit-seed',
              is_secret: false,
              description: 'admin journey audit-row seed',
            },
          },
        )
        expect(
          res.ok(),
          `variables/create status ${res.status()} body=${(await res.text()).slice(0, 200)}`,
        ).toBeTruthy()
      })

      // ===== Step 9: /audit_logs — h1 + EE-warning + API row count > 0 =====
      await test.step('step 9: navigate to /audit_logs and assert h1 + EE-warning + API rows', async () => {
        await page.goto(`${FRONTEND_URL}/audit_logs`)
        await page.waitForLoadState('domcontentloaded')

        // Document title is 'Audit Logs | Windmill' per walk (NOT bare
        // 'Windmill' — there IS a stuff.title override on this route).
        await expect(page).toHaveTitle(/Audit Logs.*Windmill/i, { timeout: 30_000 })

        // h1 'Audit logs' visible.
        await expect(page.getByRole('heading', { name: /^Audit logs$/i })).toBeVisible({
          timeout: 30_000,
        })

        // EE-warning Alert renders on CE-no-license.
        await expect(
          page.getByText(/enterprise license to see unredacted audit logs/i).first(),
        ).toBeVisible({ timeout: 30_000 })

        // UI table is empty on CE-no-license per walk — assert API row count > 0
        // (workspace_create + add_user + groups.create + folders.create +
        //  variables.create from the prior steps surface as audit rows).
        const listRes = await request.get(
          `${API_BASE}/w/${teamWorkspaceId}/audit/list?per_page=50`,
          { headers: { Cookie: auth.cookie } },
        )
        expect(listRes.ok(), `audit/list status ${listRes.status()}`).toBeTruthy()
        const rows = (await listRes.json()) as Array<unknown>
        expect(
          Array.isArray(rows) && rows.length,
          `audit row count for ${teamWorkspaceId}`,
        ).toBeGreaterThan(0)
      })
    } finally {
      // ===== Cleanup (reverse-order) =====
      // Variable -> folder -> group -> revoke invitee -> delete workspace.
      // All scoped to the team workspace, all idempotent (404-tolerant).
      await request
        .delete(
          `${API_BASE}/w/${teamWorkspaceId}/variables/delete/${encodeURIComponent(variablePath)}`,
          { headers: { Cookie: auth.cookie } },
        )
        .catch(() => {})
      await request
        .delete(`${API_BASE}/w/${teamWorkspaceId}/folders/delete/${folderName}`, {
          headers: { Cookie: auth.cookie },
        })
        .catch(() => {})
      await request
        .delete(`${API_BASE}/w/${teamWorkspaceId}/groups/delete/${groupName}`, {
          headers: { Cookie: auth.cookie },
        })
        .catch(() => {})
      // Remove the invited user from the team workspace (best-effort).
      await request
        .post(`${API_BASE}/w/${teamWorkspaceId}/users/delete/${inviteeEmail}`, {
          headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
          data: {},
        })
        .catch(() => {})
      // Drop the team workspace itself — superadmin can delete; this also
      // releases the slug so the next run can reclaim the same id.
      await request
        .delete(`${API_BASE}/workspaces/delete/${teamWorkspaceId}`, {
          headers: { Cookie: auth.cookie },
        })
        .catch(() => {})
    }
  })
})
