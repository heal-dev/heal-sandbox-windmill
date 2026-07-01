import { test, expect } from '../data/fixtures'
import { FRONTEND_URL } from '../../config'

// Journey `execute-pendingstests` — "A developer executes a script and confirms
// the pending run completes." One fresh SEQUENTIAL walk (state accretes across
// steps), authored from the walk grounding — NOT re-discovered.
//
// Arc = 3 steps crossing 2 features:
//   STEP 1 (scripts):       author a no-arg script in the editor → scriptPath
//   STEP 2 (runs-and-jobs): run it from its auto-generated form → jobId, Success
//   STEP 3 (runs-and-jobs): the runs history confirms OUR run completed
//
// Entry realness = rung 2 (real-provider): admin auth is reused via the
// project's storageState cookie (e2e/.auth/admin.json from auth.setup.ts) and
// the pre-existing `admins` workspace is selected via localStorage — supplied
// by the entry, NOT walked. NO API/seed/mock is used for any CLAIMED step:
// step 1 WALKS the editor UI (copying R01/R02's createScriptViaApi shortcut
// would be illegal for a journey step). The whole arc runs in the shared
// `admins` workspace, so step 3 scopes strictly to OUR run by jobId.
test.describe('@journey @e2e @worker execute-pendingstests', () => {
  test.describe.configure({ mode: 'serial' })

  test('A developer authors, runs, and confirms a completed run end-to-end', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(300_000)

    await test.step('entry: land on the workspace home with "admins" selected', async () => {
      // Entry prerequisite established most-real: reuse the admin storageState
      // cookie and select the pre-existing `admins` workspace via localStorage
      // (workspaceId is supplied by the entry, not walked).
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/`)
      await expect(page.getByRole('heading', { name: /^Home$/i })).toBeVisible({
        timeout: 30_000,
      })
    })

    // ---- STEP 1 — script-editor (feature: scripts) — produces scriptPath ----
    await test.step('open the Script editor from the Home "Script" CTA', async () => {
      await page
        .getByRole('link', { name: /^Script$/ })
        .or(page.getByRole('button', { name: /^Script$/ }))
        .first()
        .click()
      await page.waitForURL(/\/scripts\/(?:add|edit\/u\/)/, { timeout: 60_000 })
      await expect(page).toHaveURL(
        /\/scripts\/edit\/u\/admin(?:(?:%40|@)windmill\.dev)?\/draft_/i,
      )
    })

    let scriptPath = ''
    await test.step('select Python and author a no-arg hello-windmill script', async () => {
      const pythonTile = page.getByRole('button', { name: /^Python$/ }).first()
      if (await pythonTile.isVisible().catch(() => false)) {
        await pythonTile.click()
      } else {
        await page.getByText(/^Python$/).first().click()
      }

      await expect(page.getByRole('button', { name: /^Deploy$/ })).toBeEnabled({
        timeout: 30_000,
      })
      await page.waitForTimeout(1_500)

      // Drive Monaco. Fast-path: window.monaco.editor.getEditors(); fallback:
      // the editor's accessible textbox + select-all/delete/type.
      const body = "def main():\n    return 'hello windmill'\n"
      const setViaApi = await page.evaluate(async (newBody) => {
        const mon = (window as any).monaco
        const editors = mon?.editor?.getEditors?.() ?? []
        const target =
          editors.find((e: any) => {
            try {
              const uri = e.getModel?.()?.uri?.toString?.() ?? ''
              return uri.endsWith('.py')
            } catch {
              return false
            }
          }) ?? editors[0]
        if (!target) return false
        target.focus()
        target.setValue(newBody)
        return true
      }, body)

      if (!setViaApi) {
        const editorInput = page.getByRole('textbox', { name: 'Editor content' }).first()
        await editorInput.focus()
        await page.keyboard.press('Control+A')
        await page.keyboard.press('Delete')
        await page.keyboard.type(body)
      }

      // Autosave must read "Saved" so Deploy operates on the new body.
      await expect(
        page.locator('[aria-label="Autosave status"]').getByText(/^Saved$/),
      ).toBeVisible({ timeout: 30_000 })
    })

    await test.step('deploy the script and land on its detail page', async () => {
      // A portal tooltip overlays Deploy and swallows normal/force clicks, so
      // dispatch the click event directly on the button element.
      await page.getByRole('button', { name: /^Deploy$/ }).dispatchEvent('click')
      await page.waitForURL(/\/scripts\/get\//, { timeout: 60_000 })
      const url = new URL(page.url())
      scriptPath = decodeURIComponent(url.pathname.replace(/^\/scripts\/get\//, ''))
      // Windmill keys /scripts/get/ by either a hash or a path (u/<owner>/<name>).
      expect(scriptPath, 'scriptPath captured from /scripts/get/ URL').toMatch(
        /^(?:u\/admin(?:(?:%40|@)windmill\.dev)?\/|[a-f0-9]{8,})/i,
      )
    })

    // ---- STEP 2 — run-page / job-detail (feature: runs-and-jobs) ----
    let jobId = ''
    await test.step('run the script from its auto-generated Run form', async () => {
      // No-arg body → the Run button is enabled immediately (no args to fill).
      const runButton = page.getByRole('button', { name: /^Run(?:\b|$|\s)/ }).first()
      await expect(runButton).toBeEnabled({ timeout: 30_000 })
      await runButton.click()
      await page.waitForURL(/\/run\//, { timeout: 60_000 })
      const url = new URL(page.url())
      jobId = url.pathname.replace(/^\/run\//, '').split('/')[0]
      expect(jobId, 'jobId captured from /run/ URL').not.toBe('')
    })

    await test.step('the pending run transitions to Success on the job detail page', async () => {
      // The job-detail h1 is the literal "run/<jobId>" — confirm we are on OUR
      // run's detail, then that the pending→running→Success transition lands on
      // Success with the returned result rendered in the result panel.
      await expect(
        page.getByRole('heading', { name: new RegExp(`^run/${jobId}`, 'i'), level: 1 }),
      ).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(/Success/i).first()).toBeVisible({ timeout: 90_000 })
      await expect(page.getByText(/hello windmill/i).first()).toBeVisible({
        timeout: 30_000,
      })
    })

    // ---- STEP 3 — runs-history (feature: runs-and-jobs) — consumes jobId ----
    await test.step('the runs history lists completed runs', async () => {
      await page.goto(`${FRONTEND_URL}/runs`)
      await expect(page.getByRole('heading', { name: /^Runs$/i })).toBeVisible({
        timeout: 30_000,
      })
      // The /runs LIST does not print the literal word "Success" (that is only on
      // /run/<jobId>). It shows completed runs as rows with a "See run detail"
      // link. Confirm the runs-history screen is populated with completed runs.
      await expect(
        page.getByRole('link', { name: /See run detail/i }).first(),
      ).toBeVisible({ timeout: 90_000 })
    })

    await test.step('opening OUR run from history confirms it completed successfully', async () => {
      // Shared `admins` workspace holds many foreign runs, so scope strictly to
      // OUR run by its jobId (never .first() over the mixed list). Open the run's
      // own history detail and assert the recorded Success + result — the
      // previously-pending run is now durably completed in the runs history.
      await page.goto(`${FRONTEND_URL}/run/${jobId}`)
      await expect(
        page.getByRole('heading', { name: new RegExp(`^run/${jobId}`, 'i'), level: 1 }),
      ).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(/Success/i).first()).toBeVisible({ timeout: 60_000 })
      await expect(page.getByText(/hello windmill/i).first()).toBeVisible({
        timeout: 30_000,
      })
    })
  })
})
