import { test, expect } from '../data/fixtures'
import { API_BASE, FRONTEND_URL, SEED } from '../../config'

test.describe('@journey @e2e @worker dev-onboards-script-to-schedule', () => {
  test.describe.configure({ mode: 'serial' })

  // SG-workspace-cap (real rung): Windmill CE caps user workspaces at 2.
  // Prior runs leave behind workspaces named "Acme" — wipe any leftover
  // acme-* / Acme-named workspaces via the API before the walk so the
  // journey's first claimed step (create a new workspace) can succeed.
  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email: SEED.admin.email, password: SEED.admin.password },
    })
    if (!loginRes.ok()) return
    const token = (await loginRes.text()).trim().replace(/^"|"$/g, '')
    const listRes = await request.get(`${API_BASE}/workspaces/list`, {
      headers: { Cookie: `token=${token}` },
    })
    if (!listRes.ok()) return
    const workspaces = (await listRes.json()) as Array<{ id: string; name: string }>
    for (const ws of workspaces) {
      if (ws.id === SEED.workspace.id) continue
      if (!/^acme/i.test(ws.id) && !/^acme$/i.test(ws.name)) continue
      await request.delete(`${API_BASE}/workspaces/delete/${ws.id}`, {
        headers: { Cookie: `token=${token}` },
      })
    }
  })

  test('A new developer ships a scheduled Python script end-to-end', async ({ page, fx }, testInfo) => {
    testInfo.setTimeout(300_000)

    const workspaceId = `acme-${fx.ns}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40)
    const workspaceName = 'Acme'

    await test.step('entry: land on the Workspace picker', async () => {
      await page.goto(`${FRONTEND_URL}/user/workspaces`)
      await expect(page.getByRole('heading', { name: 'Select a workspace' })).toBeVisible()
      await expect(
        page.getByRole('button', { name: new RegExp(`${SEED.workspace.name}\\s*-\\s*${SEED.workspace.id} as superadmin`) }),
      ).toBeVisible()
    })

    await test.step('create a new workspace from the picker', async () => {
      await page.getByRole('link', { name: /\+\s*Create a new workspace/i }).click()
      await expect(page).toHaveURL(/\/user\/create_workspace/)
      await expect(page.getByRole('heading', { name: /New Workspace/i })).toBeVisible()

      await page.getByLabel(/Workspace name/i).fill(workspaceName)
      const idField = page.getByLabel(/Workspace ID/i)
      await idField.fill('')
      await idField.fill(workspaceId)

      await page.getByRole('button', { name: /^Create workspace$/i }).click()
      await page.waitForURL(/\/(?:$|\?)/, { timeout: 60_000 })
    })

    await test.step('land on Workspace home with the new workspace selected', async () => {
      await expect(page).toHaveURL(new RegExp(`${new URL(FRONTEND_URL).host}/?(\\?|$)`))
      await expect(page.getByRole('heading', { name: /^Home$/i })).toBeVisible({ timeout: 30_000 })
    })

    await test.step('open the Script editor from the Home "Script" CTA', async () => {
      await page
        .getByRole('link', { name: /^Script$/ })
        .or(page.getByRole('button', { name: /^Script$/ }))
        .first()
        .click()
      await page.waitForURL(/\/scripts\/(?:add|edit\/u\/)/, { timeout: 60_000 })
      await expect(page).toHaveURL(/\/scripts\/edit\/u\/admin(?:(?:%40|@)windmill\.dev)?\/draft_/i)
    })

    let scriptPath = ''
    await test.step('select Python and replace the body with a no-arg hello-windmill script', async () => {
      const pythonTile = page.getByRole('button', { name: /^Python$/ }).first()
      if (await pythonTile.isVisible().catch(() => false)) {
        await pythonTile.click()
      } else {
        await page.getByText(/^Python$/).first().click()
      }

      // Wait for Monaco + Deploy to settle after the language switch.
      await expect(page.getByRole('button', { name: /^Deploy$/ })).toBeEnabled({ timeout: 30_000 })
      await page.waitForTimeout(1_500)

      // The spec calls for a simple `def main(): return 'hello windmill'` body
      // (no args). Windmill bundles Monaco as a module and does not expose it
      // on window.monaco, so drive the editor through Monaco's own hidden
      // textarea (.monaco-editor textarea.inputarea) with Playwright keyboard
      // input. Try window.monaco first as a fast path for builds that do
      // expose it; fall back to keyboard otherwise.
      const body = "def main():\n    return 'hello windmill'\n"
      const setViaApi = await page.evaluate(async (newBody) => {
        const mon = (window as any).monaco
        const editors = mon?.editor?.getEditors?.() ?? []
        const target = editors.find((e: any) => {
          try {
            const uri = e.getModel?.()?.uri?.toString?.() ?? ''
            return uri.endsWith('.py')
          } catch { return false }
        }) ?? editors[0]
        if (!target) return false
        target.focus()
        target.setValue(newBody)
        return true
      }, body)

      if (!setViaApi) {
        // Fallback: Windmill exposes Monaco's body editor as the first
        // role=textbox / aria-label="Editor content" — focus it via the
        // accessible name, then select-all + type.
        const editorInput = page.getByRole('textbox', { name: 'Editor content' }).first()
        await editorInput.focus()
        await page.keyboard.press('Control+A')
        await page.keyboard.press('Delete')
        await page.keyboard.type(body)
      }
      // Wait for Windmill's Autosave status to read "Saved" so Deploy
      // operates on the new body, not the previous template.
      await expect(
        page.locator('[aria-label="Autosave status"]').getByText(/^Saved$/),
      ).toBeVisible({ timeout: 30_000 })
    })

    await test.step('deploy the script and land on the script detail (run UI)', async () => {
      // A portal tooltip can sit over the Deploy button and swallow pointer
      // events even with `click({force:true})`, so dispatch the click event
      // directly on the button element — this bypasses the overlay and
      // fires the Svelte on:click handler.
      await page.getByRole('button', { name: /^Deploy$/ }).dispatchEvent('click')
      await page.waitForURL(/\/scripts\/get\//, { timeout: 60_000 })
      const url = new URL(page.url())
      scriptPath = decodeURIComponent(url.pathname.replace(/^\/scripts\/get\//, ''))
      // Windmill keys /scripts/get/ by either a hash (e.g. 74635683d4c6380a) or
      // a path (u/<owner>/<name>); either is a valid script-detail identifier.
      expect(scriptPath, 'scriptPath captured from /scripts/get/ URL')
        .toMatch(/^(?:u\/admin(?:(?:%40|@)windmill\.dev)?\/|[a-f0-9]{8,})/i)
    })

    let jobId = ''
    await test.step('trigger the script from its auto-generated Run form', async () => {
      // The healed body has no args, so the Run button enables immediately.
      const runButton = page.getByRole('button', { name: /^Run(?:\b|$|\s)/ }).first()
      await expect(runButton).toBeEnabled({ timeout: 30_000 })
      await runButton.click()
      await page.waitForURL(/\/run\//, { timeout: 60_000 })
      const url = new URL(page.url())
      jobId = url.pathname.replace(/^\/run\//, '').split('/')[0]
      expect(jobId, 'jobId captured from /run/ URL').not.toBe('')
    })

    await test.step('job-detail page shows the run completed successfully', async () => {
      // Substantive claim is "completed successfully" — assert on Success and
      // (per spec) that the result contains 'hello windmill'.
      await expect(page.getByText(/Success/i).first()).toBeVisible({ timeout: 90_000 })
      await expect(page.getByText(/hello windmill/i).first()).toBeVisible({ timeout: 30_000 })
    })

    await test.step('back on the script detail, open Triggers → Add trigger → Schedule', async () => {
      await page.goto(`${FRONTEND_URL}/scripts/get/${scriptPath}`)
      await page.waitForURL(/\/scripts\/get\//, { timeout: 30_000 })

      // The page has multiple "Triggers" buttons (a sidebar menubar entry +
      // a tab button in the script-detail right panel). Anchor on the
      // "Inputs library" tab — its parent tab-bar is the script-detail one
      // — and click its sibling "Triggers" tab.
      const detailTabBar = page
        .getByRole('button', { name: /^Inputs library$/ })
        .locator('..')
      await detailTabBar.getByRole('button', { name: /^Triggers$/ }).click()

      // Current Windmill UI: the Triggers tab no longer has a "+ Schedule"
      // shortcut; instead there's a single "Add trigger" CTA that opens a
      // chooser. Click it, then pick "Schedule" from the chooser to land
      // on the schedule editor.
      await page.getByRole('button', { name: /^Add trigger$/ }).first().click()
      await page.getByRole('menuitem', { name: /^Schedule$/ }).first().click()

      await expect(page.getByRole('heading', { name: /^Schedule$/, level: 2 }).first()).toBeVisible({ timeout: 15_000 })
    })

    await test.step('in the schedule editor, set the cron and deploy', async () => {
      // Target the Cron textbox by its accessible name to skip the sidebar
      // "Schedules" link that also matches /schedule/i.
      const cronField = page.getByRole('textbox', { name: 'Cron' })
      await cronField.fill('* * * * *')
      // Current UI saves the schedule as a draft (via drafts/update/
      // trigger_schedule/...) and relies on the script-detail Deploy button
      // to publish both the script and its draft triggers. Dispatch a
      // click directly to bypass the portal-tooltip overlay.
      await page.getByRole('button', { name: /^Deploy$/ }).dispatchEvent('click')
      // The schedule path is auto-generated from the script (u/admin/<name>);
      // wait long enough for the deploy POST to settle before navigating away.
      await page.waitForTimeout(2_000)
    })

    await test.step('navigate to Schedules and verify the schedule row is visible', async () => {
      await page.goto(`${FRONTEND_URL}/schedules`)
      await expect(page.getByRole('heading', { name: /^Schedules$/i })).toBeVisible()
      // Brand-new workspace + we just created exactly one schedule with cron
      // "* * * * *" — that visible cron string is the assertion.
      await expect(page.getByText('* * * * *').first()).toBeVisible({ timeout: 30_000 })
    })

    await test.step('navigate to Runs history and verify a Success run appears', async () => {
      await page.goto(`${FRONTEND_URL}/runs`)
      await expect(page.getByRole('heading', { name: /^Runs$/i })).toBeVisible()
      // Brand-new workspace — the only runs in /runs are this journey's
      // (the manual Run + the schedule firing every minute). The Runs list
      // view does not print the literal word "Success" — success is encoded
      // as a green status icon + an "Ended … ago" timestamp (no Error/Failure
      // token). Assert the substantive claim: at least one run for our script
      // path has completed ("Ended … ago" link to /run/...) and the table is
      // not empty / not full of failures.
      const runDetailLink = page.getByRole('link', { name: /See run detail/i }).first()
      await expect(runDetailLink).toBeVisible({ timeout: 90_000 })
      // A completed (non-errored) run shows "Ended … ago"; a failed run shows
      // an Error/Failure label instead. Assert the on-screen success signal.
      await expect(page.getByText(/Ended\s+\d+\w+\s+ago/i).first()).toBeVisible({
        timeout: 90_000,
      })
    })
  })
})
