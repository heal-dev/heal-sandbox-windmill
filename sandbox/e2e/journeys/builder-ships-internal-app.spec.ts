import { test, expect } from '../data/fixtures'
import { API_BASE, FRONTEND_URL, SEED } from '../../config'
import { loginAdmin } from '../helpers/workspaceApi'
import { createScriptViaApi, tryDeleteScriptViaApi } from '../helpers/scriptsApi'
import {
  buttonAppValue,
  createAppViaApi,
  tryDeleteAppViaApi,
} from '../helpers/appsApi'

// Journey: A builder turns an existing Python script into a low-code app
// (buttoncomponent + inline runnable), publishes it to /apps/get/<path>,
// creates a group via the /groups UI, shares the app with the group through
// the GENERIC granular_acls endpoint (windmill-api-groups/src/granular_acls.rs;
// the apps router has no setpath/perms route — confirmed by walk), and
// re-asserts the published app still renders for the owner.
//
// Per spec walkNotes:
//  - Script create + app create are API-shortcuts (Monaco + builder drag-drop
//    are out of scope per scripts / apps feature walkNotes).
//  - /apps/get/<path> mounts NO h1 / role=heading — the only on-host signal
//    is the document title 'App <path> | Windmill'. Web-first matcher used.
//  - The owner's title is identical before AND after the group ACL grant
//    (walk confirmed). Sharing does not regress owner visibility.

const WID = SEED.workspace.id

test.describe('@journey @journey:builder-ships-internal-app @worker builder-ships-internal-app', () => {
  test.describe.configure({ mode: 'serial' })

  test('Builder ships a script-backed app and shares it with a group', async ({
    page,
    request,
    fx,
  }, testInfo) => {
    testInfo.setTimeout(300_000)

    const slug = fx.ns.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 24)
    const scriptPath = `u/admin/builder-script-${slug}`
    const appPath = `u/admin/builder-app-${slug}`
    const groupName = `builders-${slug}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50)
    const payload = `hello-${slug}`

    const auth = await loginAdmin(request)
    await page.addInitScript(() => {
      try { localStorage.setItem('workspace', 'admins') } catch {}
    })

    // Defensive: clear any leftover artifacts from a prior run.
    await tryDeleteAppViaApi(request, auth, appPath).catch(() => {})
    await tryDeleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    await request
      .delete(`${API_BASE}/w/${WID}/groups/delete/${groupName}`, { headers: { Cookie: auth.cookie } })
      .catch(() => {})

    try {
      // ===== Step 1: API-precondition — deploy the script =====
      await test.step('step 1: deploy a Python script via API (precondition; the journey turns this INTO an app)', async () => {
        const content = `def main():\n    # ns: ${slug}\n    return '${payload}'\n`
        await createScriptViaApi(request, auth, {
          path: scriptPath,
          language: 'python3',
          content,
          summary: `builder journey script ${slug}`,
        })
      })

      // ===== Step 2: author + deploy the app via API =====
      // Per spec walkNote concession + apps feature walkNote: builder drag-drop
      // is out of scope. The buttonAppValue helper builds a single buttoncomponent
      // backed by an inline Python runnable that returns the same payload.
      await test.step('step 2: create app via API with buttonAppValue (builder UI is out of scope)', async () => {
        const returned = await createAppViaApi(request, auth, {
          path: appPath,
          summary: `Builder app ${slug}`,
          value: buttonAppValue(slug, payload),
          policy: { execution_mode: 'viewer' },
        })
        expect(returned).toBe(appPath)
      })

      // ===== Step 3: navigate to /apps/get/<appPath>; viewer mounts =====
      // The app's own markup is inside an opaque /app_embed iframe (forbidden
      // to assert into per apps walkNotes). The on-host signal is the
      // SvelteKit-rendered document title 'App <path> | Windmill'.
      await test.step('step 3: navigate to /apps/get/<appPath> and assert the viewer mounts (title-based)', async () => {
        await page.goto(`${FRONTEND_URL}/apps/get/${appPath}`)
        await page.waitForLoadState('domcontentloaded')
        await expect(page).toHaveTitle(new RegExp(`App\\s+u/admin/builder-app-${slug}.*Windmill`, 'i'), {
          timeout: 30_000,
        })
      })

      // ===== Step 4: /groups — create a group via UI =====
      await test.step('step 4: navigate to /groups and create a group via UI (UP04.S1 vocabulary)', async () => {
        await page.goto(`${FRONTEND_URL}/groups`)
        await page.waitForLoadState('domcontentloaded')
        await expect(page.getByRole('heading', { name: /^Groups$/ })).toBeVisible({ timeout: 30_000 })

        await page.getByRole('button', { name: /^New group$/ }).first().click()

        // Popover input — aria-label 'New group name' per walk (confirmed in
        // discoveredVocabulary.groups.popover-textboxes: [{"name":"New group name"}]).
        const groupInput = page
          .getByRole('textbox', { name: /New group name/i })
          .first()
          .or(page.locator('input[placeholder*="name" i]').last())
        await expect(groupInput).toBeVisible({ timeout: 10_000 })
        await groupInput.fill(groupName)

        await page.getByRole('button', { name: /^Create$/ }).first().click()

        // Row appears in the list. groupName is unique-per-test (slug-suffixed),
        // so plain text presence is enough.
        await expect(page.getByText(groupName, { exact: false }).first()).toBeVisible({
          timeout: 20_000,
        })
      })

      // ===== Step 5: API-share — grant the group write access via /acls/add =====
      // No app-side perms UI exists (confirmed by walk + apps router source).
      // The granular_acls endpoint is the only sharing surface.
      await test.step('step 5: share the app with the group via /acls/add/app (no perms UI exists for apps)', async () => {
        const url = `${API_BASE}/w/${WID}/acls/add/app/${appPath}`
        const res = await request.post(url, {
          headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
          data: { owner: `g/${groupName}`, write: true },
        })
        expect(
          res.ok(),
          `acls/add status ${res.status()} body=${(await res.text()).slice(0, 200)}`,
        ).toBeTruthy()

        // Verify the perm landed.
        const get = await request.get(`${API_BASE}/w/${WID}/acls/get/app/${appPath}`, {
          headers: { Cookie: auth.cookie },
        })
        expect(get.ok(), `acls/get status ${get.status()}`).toBeTruthy()
        const acls = (await get.json()) as Record<string, boolean>
        expect(acls[`g/${groupName}`], `g/${groupName} present in acls`).toBe(true)
      })

      // ===== Step 6: re-visit /apps/get/<appPath>; owner visibility intact =====
      // Walk confirmed title is identical before and after the group grant.
      await test.step('step 6: re-visit /apps/get/<appPath> and assert title still matches (share did not regress owner)', async () => {
        await page.goto(`${FRONTEND_URL}/apps/get/${appPath}`)
        await page.waitForLoadState('domcontentloaded')
        await expect(page).toHaveTitle(new RegExp(`App\\s+u/admin/builder-app-${slug}.*Windmill`, 'i'), {
          timeout: 30_000,
        })
      })
    } finally {
      // Cleanup in reverse creation order (revoke -> group -> app -> script).
      // All idempotent / 404-tolerant.
      await request
        .post(`${API_BASE}/w/${WID}/acls/remove/app/${appPath}`, {
          headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
          data: { owner: `g/${groupName}` },
        })
        .catch(() => {})
      await request
        .delete(`${API_BASE}/w/${WID}/groups/delete/${groupName}`, { headers: { Cookie: auth.cookie } })
        .catch(() => {})
      await tryDeleteAppViaApi(request, auth, appPath).catch(() => {})
      await tryDeleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
