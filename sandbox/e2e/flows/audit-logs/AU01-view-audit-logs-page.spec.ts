import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, API_BASE, SEED } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { listAuditLogs } from '../../helpers/auditApi'

// AU01 — Read-only render of /audit_logs on the CE-redacted sandbox stack.
//
// Backend invariants:
//  - On Windmill OSS without the `private` feature the audit handlers are
//    no-ops (windmill-audit/src/audit_oss.rs L91-109): list_audit returns []
//    and get_audit returns 404 "Audit log not available in Windmill Community
//    edition". The sandbox stack happens to ship the EE binary, but values are
//    masked because no EE license key is wired in — every row comes back with
//    operation="redacted", resource="EE only", parameters={redacted:"-"}, and
//    the UI renders the warning Alert "You need an enterprise license to see
//    unredacted audit logs." (audit_logs/+page.svelte L153-158).
//  - The page renders the table column headers ID | Timestamp | Username |
//    Operation | Resource (AuditLogsTable.svelte L134-143) regardless of
//    whether the row list is empty.
//
// The precondition probe asserts the audit endpoint reachable (non-zero rows
// already exist on the sandbox stack from previous test mutations) — this
// keeps AU01 stable even when no test has run in the current process.

const wid = SEED.workspace.id

test.describe('@flow @feature:audit-logs @worker AU01 — View audit logs page', () => {
  test('h1 "Audit logs" + redaction alert + column headers + table renders', async ({
    page,
    request,
  }) => {
    const auth = await loginAdmin(request)

    // API precondition — audit list reachable; backend redacts the rows on
    // CE but the array shape is well-formed and the table header still
    // renders even when empty.
    const rows = await listAuditLogs(request, auth, { per_page: 5 })
    expect(Array.isArray(rows), 'audit/list returns an array').toBe(true)
    // The sandbox stack has accumulated workspace mutations from prior runs,
    // so on a stable env there is at least one row.  We do NOT assert >= 1
    // because a freshly-truncated DB is a legitimate edge case; AU03 covers
    // the "new row appears after a mutation" invariant.

    await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
    await page.goto(`${FRONTEND_URL}/audit_logs`)

    // /audit_logs is a (logged) route — no SvelteKit `stuff.title` override,
    // so the document title falls through to the layout default "Windmill".
    await expect(page).toHaveTitle(/Windmill/i, { timeout: 30_000 })

    // audit_logs/+page.svelte L92 — h1 "Audit logs"
    await expect(
      page.getByRole('heading', { name: /^Audit logs$/, level: 1 }),
    ).toBeVisible({ timeout: 30_000 })

    // CE redaction alert — audit_logs/+page.svelte L154-158. Rendered when
    // $enterpriseLicense is falsy or ends with "_pro".
    await expect(
      page.getByText(/You need an enterprise license to see unredacted audit logs\./i),
    ).toBeVisible({ timeout: 30_000 })

    // AuditLogsTable header row (AuditLogsTable.svelte L131-143) — five fixed
    // columns on the non-showWorkspace branch. The same column words appear
    // as hidden floating labels on the AuditLogsFilters Select widgets
    // (`<span class="absolute -top-4">Username</span>`), AND the page mounts
    // two #audit-logs-table-wrapper elements (one desktop, one mobile-hidden
    // copy at L198-213). Scope to the FIRST wrapper and use .first() inside
    // it to dodge both ambiguities.
    const tableWrapper = page.locator('#audit-logs-table-wrapper').first()
    await expect(tableWrapper).toBeVisible({ timeout: 30_000 })
    for (const col of ['ID', 'Timestamp', 'Username', 'Operation', 'Resource']) {
      await expect(
        tableWrapper.getByText(col, { exact: true }).first(),
      ).toBeVisible({ timeout: 30_000 })
    }
  })
})
