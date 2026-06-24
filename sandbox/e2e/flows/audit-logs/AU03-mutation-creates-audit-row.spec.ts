import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, SEED } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import { listAuditLogs } from '../../helpers/auditApi'

// AU03 — Every workspace mutation appends an audit_log row.
//
// Windmill writes an audit row from inside the same transaction as each
// resource mutation (see windmill_audit::audit_log called from
// windmill-api/src/scripts.rs create_script / delete_script handlers). The
// row exists even on CE-redacted mode — `id`, `timestamp`, `username`, and
// `action_kind` are unredacted; only `operation` / `resource` / `parameters`
// fall back to the "redacted" / "EE only" / {redacted:"-"} sentinels.
//
// The test:
//   1. Snapshots the current max(id) by listing the top page;
//   2. Performs a Create + Delete on a fresh script path;
//   3. Re-lists and asserts at least 2 new rows arrived, both attributed to
//      the seeded admin, with action_kind covering both Create and Delete.

const wid = SEED.workspace.id

test.describe('@flow @feature:audit-logs @worker AU03 — Mutation creates audit row', () => {
  test('script create+delete appends >=2 new audit rows attributed to the actor', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `au03-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30)
    const scriptPath = `u/admin/${slug}`

    // 1. Baseline — snapshot the highest id currently visible. The
    //    /audit/list endpoint returns rows ordered by id DESC, so the first
    //    element of the first page is the most recent row globally.
    const before = await listAuditLogs(request, auth, { per_page: 1 })
    const baselineMaxId = before[0]?.id ?? 0

    try {
      // Pre-clean any leftover row at this path (defensive).
      await tryDeleteScriptViaApi(request, auth, scriptPath)

      // 2. Create + Delete — each writes exactly one audit_log row.
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    return '${slug}'\n`,
        summary: `AU03 ${slug}`,
      })
      await deleteScriptViaApi(request, auth, scriptPath)

      // 3. Re-list and filter to rows newer than the baseline. We page big
      //    enough to absorb any other unrelated test activity that may have
      //    raced into the audit log between our snapshot and re-list.
      const after = await listAuditLogs(request, auth, {
        per_page: 100,
        username: SEED.admin.email,
      })
      const newRows = after.filter((r) => r.id > baselineMaxId)
      expect(newRows.length, 'create+delete must append at least 2 audit rows').toBeGreaterThanOrEqual(2)
      for (const row of newRows) {
        expect(row.username, 'every new row attributed to the seeded admin').toBe(
          SEED.admin.email,
        )
        expect(row.workspace_id, 'every new row scoped to the workspace').toBe(wid)
      }
      const kinds = new Set(newRows.map((r) => r.action_kind))
      expect(kinds.has('Create'), `expected a Create row in ${[...kinds].join(',')}`).toBe(true)
      expect(kinds.has('Delete'), `expected a Delete row in ${[...kinds].join(',')}`).toBe(true)

      // UI observation — navigate to /audit_logs and assert the table wrapper
      // renders and the actor's username is visible inside it. Since the
      // create+delete just appended >=2 rows attributed to SEED.admin.email,
      // that email is guaranteed to appear in the (id-DESC ordered) table.
      // Scope to the FIRST wrapper to dodge the duplicated desktop/mobile
      // nodes (see AU01 comment for context).
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/audit_logs`)
      await expect(page).toHaveTitle(/Windmill/i, { timeout: 30_000 })
      const tableWrapper = page.locator('#audit-logs-table-wrapper').first()
      await expect(tableWrapper).toBeVisible({ timeout: 30_000 })
      await expect(
        tableWrapper.getByText(SEED.admin.email, { exact: false }).first(),
      ).toBeVisible({ timeout: 30_000 })
    } finally {
      // Belt-and-braces — if the test failed mid-stream, scrub the script
      // (the Delete in step 2 may not have run).
      await tryDeleteScriptViaApi(request, auth, scriptPath)
    }
  })
})
