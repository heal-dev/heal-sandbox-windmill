import { test, expect } from '../../data/fixtures'
import { API_BASE, FRONTEND_URL, SEED } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import { listAuditLogs } from '../../helpers/auditApi'

// AU02 — Filtering audit logs by action_kind.
//
// The /audit/list ListAuditLogQuery accepts an `action_kind` query string
// (windmill-audit/src/lib.rs L33). The backend deserialises it directly into
// the ACTION_KIND Postgres enum which is declared `rename_all = "lowercase"`
// (windmill-audit/src/lib.rs L9) — so the API requires LOWERCASE values
// ("create" / "update" / "delete" / "execute"). Capitalised values fall
// through to PG and return a SQL error visible to the client. This contract
// is load-bearing for the AuditLogsTable badge click handler, which calls
// `actionKind = log.action_kind.toLocaleLowerCase()` before re-fetching
// (AuditLogsTable.svelte L237-238).
//
// To guarantee at least one Create row exists for the filter assertion, we
// first create+delete a throwaway script — every script CRUD writes an
// audit_log row (windmill-api/src/scripts.rs records scripts.create with
// action_kind=Create on POST /scripts/create). Even on CE-redacted mode the
// action_kind column is preserved (only `operation` / `resource` / `parameters`
// are redacted), which is exactly what this test relies on.

const wid = SEED.workspace.id

test.describe('@flow @feature:audit-logs @worker AU02 — Filter by action_kind', () => {
  test('action_kind=create returns only Create rows; uppercase is rejected', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `au02-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30)
    const scriptPath = `u/admin/${slug}`

    try {
      // Pre-clean any leftover row at this path so the create below cannot
      // fall into a "path already exists" branch.
      await tryDeleteScriptViaApi(request, auth, scriptPath)

      // Mutation 1 (Create): deploy a tiny Python script — guaranteed to
      // append at least one audit_log row with action_kind=Create.
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    return '${slug}'\n`,
        summary: `AU02 ${slug}`,
      })

      // Filter by Create — every returned row's action_kind must be exactly
      // "Create" (the response serialises the enum capitalised — see the
      // AuditLog struct's #[derive(Serialize)] with no rename — even though
      // the filter takes lowercase).
      const createRows = await listAuditLogs(request, auth, {
        per_page: 20,
        action_kind: 'create',
      })
      expect(createRows.length, 'expected at least one Create row after script create').toBeGreaterThan(0)
      for (const row of createRows) {
        expect(row.action_kind, `row ${row.id} should be Create`).toBe('Create')
      }

      // Filter by Delete — symmetric assertion. Many tests on this sandbox
      // run deletes, so there is almost certainly at least one Delete row.
      const deleteRows = await listAuditLogs(request, auth, {
        per_page: 20,
        action_kind: 'delete',
      })
      for (const row of deleteRows) {
        expect(row.action_kind, `row ${row.id} should be Delete`).toBe('Delete')
      }

      // Uppercase enforcement — bypass the helper (which can only accept the
      // typed lowercase variants) and hit the URL directly. The PG enum
      // rejects "Create" with a SqlErr; the backend bubbles it as 500.
      const badRes = await request.get(
        `${API_BASE}/w/${wid}/audit/list?per_page=5&action_kind=Create`,
        { headers: { Cookie: auth.cookie } },
      )
      expect(badRes.status(), 'uppercase action_kind must be rejected').toBeGreaterThanOrEqual(400)
      const body = await badRes.text()
      expect(body, 'error body should reference invalid enum value').toMatch(
        /invalid input value for enum action_kind/i,
      )

      // UI observation — navigate to /audit_logs and assert the table wrapper
      // is rendered in the DOM. The mutation above has appended at least one
      // Create row, so the audit-logs page is the natural place to observe
      // that the backend state is reflected client-side. See AU01 for the
      // same wrapper-scoping rationale (two #audit-logs-table-wrapper nodes
      // exist on the page; we scope to the first).
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/audit_logs`)
      await expect(page).toHaveTitle(/Windmill/i, { timeout: 30_000 })
      const tableWrapper = page.locator('#audit-logs-table-wrapper').first()
      await expect(tableWrapper).toBeVisible({ timeout: 30_000 })
    } finally {
      await tryDeleteScriptViaApi(request, auth, scriptPath)
    }
  })
})
