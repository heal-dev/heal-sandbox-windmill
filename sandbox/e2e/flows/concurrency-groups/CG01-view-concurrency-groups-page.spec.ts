import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { listConcurrencyGroupsViaApi } from '../../helpers/concurrencyApi'

// CG01 — Read-only render of /concurrency_groups.
//
// Backend invariants:
//  - GET /api/concurrency_groups/list is a GLOBAL admin endpoint (no
//    /w/<wid>/ prefix); the handler at windmill-api-jobs/src/concurrency_groups.rs
//    L42-62 gates with require_admin and returns an array of
//    { concurrency_key, total_running } rows derived from concurrency_counter.
//  - The /concurrency_groups page (+page.svelte L67-77) ALWAYS renders the
//    PageHeader 'Concurrency Groups' (capital G) and the 'Refresh' Button,
//    regardless of whether any groups exist. The TableCustom only mounts when
//    concurrencyGroups.length > 0 (L78), so there is intentionally NO
//    empty-state copy — the absence of the table IS the empty state.
//  - +page.js sets stuff.title='Concurrency groups' (lower-case g), so
//    document.title is 'Concurrency groups | Windmill'. Heading text vs.
//    document.title DIVERGE on the 'g' case — see walkNotes.

test.describe('@flow @feature:concurrency-groups @worker CG01 — View concurrency groups page', () => {
  test('PageHeader "Concurrency Groups" + Refresh button render even when empty', async ({
    page,
    request,
  }) => {
    const auth = await loginAdmin(request)

    // API precondition — the global admin /list endpoint returns an array
    // (possibly empty). We do NOT assert .length because the list reflects
    // live state and may be populated or empty depending on what other tests
    // have left behind. Asserting the array shape catches a wider class of
    // regressions (e.g. 401 from auth refactors, 500 from schema drift)
    // without binding the test to incidental concurrency activity.
    const groups = await listConcurrencyGroupsViaApi(request, auth)
    expect(Array.isArray(groups), '/concurrency_groups/list returns an array').toBe(true)
    for (const g of groups) {
      expect(typeof g.concurrency_key, 'each row has a string concurrency_key').toBe('string')
      expect(typeof g.total_running, 'each row has a numeric total_running').toBe('number')
    }

    await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
    await page.goto(`${FRONTEND_URL}/concurrency_groups`)

    // +page.js sets stuff.title='Concurrency groups' (lower-case g) — the
    // SvelteKit layout renders 'Concurrency groups | Windmill' as the doc
    // title. Asserting via the loose /Concurrency groups/i regex matches the
    // page's own title AND keeps the test resilient to layout suffix changes.
    await expect(page).toHaveTitle(/Concurrency groups/i, { timeout: 30_000 })

    // PageHeader title is 'Concurrency Groups' (capital G) — note the case
    // divergence vs. the document title. Asserting via heading-role-with-name
    // pins both the visible text and the semantic level (h1 from PageHeader).
    await expect(
      page.getByRole('heading', { name: /^Concurrency Groups$/, level: 1 }),
    ).toBeVisible({ timeout: 30_000 })

    // The PageHeader exposes exactly one Button labelled 'Refresh' (Button
    // child of PageHeader at .svelte L68-75 with the literal text 'Refresh').
    // The button is always present — it triggers a manual loadConcurrencyGroupsOnce()
    // call regardless of whether the auto-poll has fired.
    await expect(
      page.getByRole('button', { name: /^Refresh$/ }),
    ).toBeVisible({ timeout: 30_000 })
  })
})
