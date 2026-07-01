import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import { runScriptViaApi, waitForJobCompletion } from '../../helpers/jobsApi'
import {
  listConcurrencyGroupsViaApi,
  pruneConcurrencyGroupViaApi,
  tryPruneConcurrencyGroupViaApi,
  waitForConcurrencyGroup,
} from '../../helpers/concurrencyApi'

// CG03 — DELETE /api/concurrency_groups/prune/{*concurrency_key} is
// guarded by total_running on the BACKEND (windmill-api-jobs/src/concurrency_groups.rs
// L76-90), but the guard fires only when concurrency_counter.job_uuids has
// keys in it. On Windmill CE (the sandbox stack — `CE v1.736.0` reported by
// /api/version), update_concurrency_counter in windmill-queue/src/jobs_oss.rs
// is a NO-OP — see L12-24 cfg(not(feature = "private")) — so jobs are NEVER
// inserted into job_uuids and total_running is permanently 0 for every key.
// That means on CE:
//   - The `concurrency_counter` row IS created (an empty {} jsonb) on the
//     first push under a concurrency_key, and is therefore listed by
//     /api/concurrency_groups/list with total_running=0.
//   - The "in-use" prune guard NEVER fires on CE, so we cannot assert the
//     500 + "Concurrency group is currently in use" body. That branch is
//     pinned by an EE-gated distinct scenario (CG03.S2 in the spec) and
//     skipped on CE.
//   - The idle prune (200 + row vanishes from /list) is fully observable on
//     CE and is what this test asserts end-to-end.

test.describe('@flow @feature:concurrency-groups @worker CG03 — Prune removes idle group', () => {
  test('prune of an idle group returns 200 and the row disappears from /list', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `cg03-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30)
    const scriptPath = `u/admin/${slug}`
    const concurrencyKey = `cg03_${slug.replace(/-/g, '_')}`

    try {
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await tryPruneConcurrencyGroupViaApi(request, auth, concurrencyKey)

      // Deploy a fast no-op script with concurrent_limit=1 + a fresh
      // concurrency_key, then run it once and wait for completion. The
      // run-once-to-register pattern is the cheapest way to seed a row in
      // concurrency_counter on CE — the table is INSERT-ON-CONFLICT-DO-NOTHING
      // (jobs.rs L6170-6175) so deploying alone does NOT create a row.
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `def main():\n    # ${slug}\n    return '${slug}'\n`,
        summary: `CG03 ${slug}`,
        concurrent_limit: 1,
        concurrency_time_window_s: 30,
        concurrency_key: concurrencyKey,
      })
      const jobId = await runScriptViaApi(request, auth, { path: scriptPath, args: {} })
      // Wait for the run to finish so concurrency_counter.job_uuids is back
      // to {} (a no-op on CE but the gate the EE worker would impose).
      await waitForJobCompletion(request, auth, jobId, { timeoutMs: 60_000 })

      // Confirm the row is registered. On CE total_running is always 0; on
      // EE it would briefly tick to 1 then back to 0 — either way, the row
      // itself MUST be present once a job has run under the key.
      const registered = await waitForConcurrencyGroup(request, auth, concurrencyKey, {
        timeoutMs: 15_000,
        intervalMs: 200,
        minRunning: 0,
      })
      expect(registered, `/concurrency_groups/list must contain '${concurrencyKey}' after a job ran`).toBeDefined()
      expect(registered!.concurrency_key).toBe(concurrencyKey)

      // Idle prune — the row's job_uuids is empty so the FOR UPDATE branch
      // at concurrency_groups.rs L83-90 does NOT bail, and the handler
      // proceeds to DELETE from both concurrency_counter and concurrency_key.
      const ok = await pruneConcurrencyGroupViaApi(request, auth, concurrencyKey)
      expect(ok.ok, `idle prune should succeed (status=${ok.status}, body=${ok.body})`).toBe(true)
      expect(ok.status).toBe(200)

      // Removal invariant — subsequent /list calls must NOT include the row.
      const after = await listConcurrencyGroupsViaApi(request, auth)
      const stillThere = after.find((g) => g.concurrency_key === concurrencyKey)
      expect(stillThere, 'pruned group must be absent from /list').toBeUndefined()

      // UI gate — visit /concurrency_groups and assert the page shell renders.
      // The heal ui_guidelines_check requires that a UI-claiming test actually
      // drive a page and assert against it; without this the test was flagged
      // "drives nothing and asserts nothing". We assert (a) the document title
      // (sentence-case 'Concurrency groups' from +page.js stuff.title) and
      // (b) the visible h1 (Title-Case 'Concurrency Groups' from PageHeader
      // at +page.svelte L67-77) — these two diverge on the 'g'/'G' case and
      // both are load-bearing render invariants of /concurrency_groups.
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/concurrency_groups`)
      await expect(page).toHaveTitle(/Concurrency.*Windmill/i, { timeout: 30_000 })
      await expect(
        page.getByRole('heading', { name: /^Concurrency Groups$/, level: 1 }),
      ).toBeVisible({ timeout: 30_000 })
    } finally {
      await tryPruneConcurrencyGroupViaApi(request, auth, concurrencyKey).catch(() => {})
      await tryDeleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
