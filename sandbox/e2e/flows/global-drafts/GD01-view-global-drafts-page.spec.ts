import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { listDraftsViaApi } from '../../helpers/draftsApi'

// GD01 — Render the /global_drafts dev-only inspector page chrome.
//
// Backend invariants:
//  - GET /api/w/admins/drafts/list returns Vec<DraftListItem> for the authed
//    user (drafts.rs L82-141). Even when the user has no drafts the response
//    is 200 with an empty JSON array — never 404.
//  - The /global_drafts route is dev-only and is hidden behind a localStorage
//    gate (gate.ts L17-26): without `wm_dev_global_ai === '1'` the page's
//    onMount calls goto('/'). So the spec MUST set the key in an addInitScript
//    before navigating, else the test asserts against the home page chrome.
//  - +page.js (global_drafts/+page.js L1-5) sets stuff.title='Global AI drafts'
//    so document.title is 'Global AI drafts | Windmill'. The on-page h1 is
//    'Global local drafts' (+page.svelte L80) — heading text and document
//    title diverge (cf. /concurrency_groups).
//  - The 'Clear all' Button is always rendered in the header
//    (+page.svelte L83-90); it is `disabled={drafts.length === 0}` but the
//    button NODE is still in the DOM, so role-based visibility holds even
//    on a fresh workspace.
test.describe('@flow @feature:global-drafts @worker GD01 — View /global_drafts page', () => {
  test('h1 "Global local drafts" + Clear all button render even when empty', async ({
    page,
    request,
  }) => {
    const auth = await loginAdmin(request)

    // API precondition: drafts/list returns an array (possibly empty —
    // unrelated tests in this suite may have left drafts behind). We do not
    // assert `.length === 0` because the suite runs in parallel.
    const rows = await listDraftsViaApi(request, auth)
    expect(Array.isArray(rows), '/drafts/list returns an array').toBe(true)
    for (const r of rows) {
      expect(typeof r.kind, 'each row has a string kind').toBe('string')
      expect(typeof r.path, 'each row has a string path').toBe('string')
      expect(typeof r.created_at, 'each row has a created_at string').toBe('string')
    }

    // BOTH keys MUST be set before the (logged) layout runs: `workspace`
    // because every (logged) route redirects to /user/workspaces without it,
    // and `wm_dev_global_ai` because the page's onMount goto('/')s when the
    // gate is closed (gate.ts L19-26). addInitScript runs before any module
    // code on the next nav, so the page sees both.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('workspace', 'admins')
        localStorage.setItem('wm_dev_global_ai', '1')
      } catch {}
    })
    await page.goto(`${FRONTEND_URL}/global_drafts`)

    // document.title comes from +page.js stuff.title='Global AI drafts'; the
    // SvelteKit layout suffixes ' | Windmill'. Loose regex tolerates the
    // suffix and any future tweak to it.
    await expect(page).toHaveTitle(/Global AI drafts/i, { timeout: 30_000 })

    // The page-level h1 (literal in +page.svelte L80) — note this is the only
    // assertion that proves the gate let us in. If `wm_dev_global_ai` is unset
    // the page's onMount goto('/')s and this expect times out.
    await expect(
      page.getByRole('heading', { name: /^Global local drafts$/, level: 1 }),
    ).toBeVisible({ timeout: 30_000 })

    // 'Clear all' Button is rendered unconditionally — only its `disabled`
    // attribute flips with drafts.length. Asserting visibility (not enabled
    // state) keeps the test green on both empty and populated workspaces.
    await expect(page.getByRole('button', { name: /^Clear all$/ })).toBeVisible({
      timeout: 30_000,
    })
  })
})
