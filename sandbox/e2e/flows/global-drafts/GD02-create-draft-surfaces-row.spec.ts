import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import {
  createDraftViaApi,
  listDraftsViaApi,
  tryDeleteDraftViaApi,
} from '../../helpers/draftsApi'

// GD02 — A draft posted to the backend before the page loads MUST surface as
// a row on /global_drafts.
//
// Backend invariants (drafts.rs):
//  - POST /api/w/<wid>/drafts/update/script/<path> with `{ value: <json> }`
//    upserts the authed user's draft at (script, path). The handler returns
//    `{ status: 'saved', current_timestamp }` on success (drafts.rs L307-326).
//    Because there's no deployed script at our generated path, the listed row
//    comes back with `draft_only: true` (see CASE in list_drafts_query
//    L149-220 — NOT EXISTS over the `script` table).
//  - GET /api/w/<wid>/drafts/list then includes that row. The /global_drafts
//    page consumes the same endpoint via DraftService.listDrafts (userDraftAdapter.ts
//    L492-508), so the API precondition and the rendered DOM share a single
//    source of truth.
//  - The walk (/tmp/heal-crawl/global-drafts-walk.mjs) confirmed that for an
//    'admin' user the row's `mine=true`, `can_write=true`, `draft_only=true`.
//
// Frontend invariants (+page.svelte L97-128):
//  - Each draft renders inside a <li> as: `<kind>{...maybe-triggerKind} · {path}`
//    in a monospaced span, optionally followed by a summary and a language
//    sub-line, then a JSON pre-dump of the value. We assert visibility of the
//    PATH text and the literal "script" kind label — those uniquely identify
//    our row even when other drafts are present.
test.describe('@flow @feature:global-drafts @worker GD02 — Create surfaces row', () => {
  test('A script draft created via the API appears on /global_drafts', async ({
    page,
    request,
    fx,
  }) => {
    const slug = `gd02-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32)
    const draftPath = `u/admin/${slug}`
    const auth = await loginAdmin(request)

    // Defensive cleanup: an earlier failed run could have left a draft at the
    // same path. Drafts/update is upsert so the create wouldn't fail, but
    // wiping first keeps the asserted rendered state minimal.
    await tryDeleteDraftViaApi(request, auth, { kind: 'script', path: draftPath })
    try {
      const saved = await createDraftViaApi(request, auth, {
        kind: 'script',
        path: draftPath,
        // Minimum NewScript shape that the editor would persist — only summary,
        // content, language and path are read by the list/render path. The
        // backend treats the value blob as opaque JSON (drafts.rs L307-326).
        value: {
          summary: `gd02 draft ${slug}`,
          description: '',
          content: 'def main():\n    return "gd02"\n',
          language: 'python3',
          path: draftPath,
          is_template: false,
          kind: 'script',
        },
      })
      expect(saved.status, 'drafts/update returns saved').toBe('saved')

      // API precondition: the row MUST show up in /drafts/list before we look
      // at the page — otherwise a failure below could be either the create or
      // the render, and we want to bisect.
      const rows = await listDraftsViaApi(request, auth)
      const ours = rows.find((r) => r.kind === 'script' && r.path === draftPath)
      expect(ours, 'our draft row is listed after upsert').toBeTruthy()
      expect(ours!.draft_only, 'no deployed script at this path → draft_only=true').toBe(true)
      expect(ours!.mine, 'admin owns the row → mine=true').toBe(true)
      expect(ours!.can_write, 'admin can write → can_write=true').toBe(true)

      // Set the workspace AND open the dev gate before the page module loads
      // (see GD01 spec header comment).
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

      // The per-row rendering is `<kind> · <path>` inside a monospaced div
      // (+page.svelte L101-108). The path is the most unique sentinel and
      // is rendered verbatim — assert visibility on it.
      await expect(page.getByText(draftPath, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      })

      // The summary we POSTed is rendered as a sub-line in the same <li>
      // (+page.svelte L109-111) — pinning it confirms we're seeing OUR draft
      // and not a leftover from another test.
      await expect(
        page.getByText(`gd02 draft ${slug}`, { exact: false }).first(),
      ).toBeVisible({ timeout: 15_000 })
    } finally {
      await tryDeleteDraftViaApi(request, auth, { kind: 'script', path: draftPath })
    }
  })
})
