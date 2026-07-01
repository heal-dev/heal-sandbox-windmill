import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createDraftViaApi,
  deleteDraftViaApi,
  listDraftsViaApi,
  tryDeleteDraftViaApi,
} from '../../helpers/draftsApi'

// GD03 — Discard removes a draft row from /global_drafts.
//
// Why API-driven, not UI-driven:
//  - The per-row Trash button on /global_drafts is rendered iconOnly via
//    `<Button startIcon={{ icon: Trash2 }} iconOnly onclick={...} />`
//    (+page.svelte L116-122). iconOnly Buttons have NO accessible name, so
//    `getByRole('button')` returns the same generic Trash for both the
//    per-row deletes AND the header 'Clear all' button (which has a label).
//    A page.locator('ul li button').first().click() WOULD work, but it then
//    races against the page's `setInterval(refreshDrafts, 1000)` and the
//    optimistic local clear in deleteGlobalDraft. Driving the DELETE through
//    the API endpoint (the same one the button ultimately hits via
//    UserDraftDbSyncer.save) makes the assertion sequence deterministic.
//
// Backend invariants:
//  - POST /api/w/<wid>/drafts/update/<kind>/<path> with `{ value: null }` is
//    the own-discard path (drafts.rs L286-289): it skips the write-permission
//    gate because the row is scoped to the authed user's email. Returns 200
//    `{ status: 'saved' }`. Idempotent: deleting an absent row still returns
//    'saved' with the server's NOW() (drafts.rs L383-391) — so the cleanup
//    branch in finally is safe.
test.describe('@flow @feature:global-drafts @worker GD03 — Delete removes row', () => {
  test('Discarding a draft drops its row from /global_drafts on reload', async ({
    page,
    request,
    fx,
  }) => {
    const slug = `gd03-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32)
    const draftPath = `u/admin/${slug}`
    const auth = await loginAdmin(request)

    await tryDeleteDraftViaApi(request, auth, { kind: 'script', path: draftPath })
    try {
      await createDraftViaApi(request, auth, {
        kind: 'script',
        path: draftPath,
        value: {
          summary: `gd03 draft ${slug}`,
          description: '',
          content: 'def main():\n    return "gd03"\n',
          language: 'python3',
          path: draftPath,
          is_template: false,
          kind: 'script',
        },
      })

      // Pre-delete sanity: row is in the list AND on the page.
      const before = await listDraftsViaApi(request, auth)
      expect(
        before.some((r) => r.kind === 'script' && r.path === draftPath),
        'draft row listed before delete',
      ).toBe(true)

      await page.addInitScript(() => {
        try {
          localStorage.setItem('workspace', 'admins')
          localStorage.setItem('wm_dev_global_ai', '1')
        } catch {}
      })
      await page.goto(`${FRONTEND_URL}/global_drafts`)
      await expect(
        page.getByRole('heading', { name: /^Global local drafts$/, level: 1 }),
      ).toBeVisible({ timeout: 30_000 })
      // Path text is the row-unique sentinel — same assertion as GD02.
      await expect(page.getByText(draftPath, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      })

      // Delete via the discard endpoint (same path the per-row Trash button
      // exercises internally — see the spec header for the rationale).
      await deleteDraftViaApi(request, auth, { kind: 'script', path: draftPath })

      // Post-delete sanity: row gone from the API listing.
      const after = await listDraftsViaApi(request, auth)
      expect(
        after.some((r) => r.kind === 'script' && r.path === draftPath),
        'draft row gone after delete',
      ).toBe(false)

      // Reload (not just wait for the 1s poll) so the assertion is independent
      // of the page's setInterval timing.
      await page.goto(`${FRONTEND_URL}/global_drafts`)
      await expect(
        page.getByRole('heading', { name: /^Global local drafts$/, level: 1 }),
      ).toBeVisible({ timeout: 30_000 })
      // Web-first matcher: assert the path text is now absent. Using
      // `toHaveCount(0)` (not `not.toBeVisible()`) is the documented Playwright
      // pattern for "this element should not appear" — it polls and avoids
      // strict-mode failures when multiple matches existed before the delete.
      await expect(page.getByText(draftPath, { exact: false })).toHaveCount(0, {
        timeout: 30_000,
      })
    } finally {
      // Idempotent: drafts/update with value=null on an absent row still 200s.
      await tryDeleteDraftViaApi(request, auth, { kind: 'script', path: draftPath })
    }
  })
})
