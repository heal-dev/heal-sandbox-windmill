import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, tryDeleteScriptViaApi } from '../../helpers/scriptsApi'
import { cancelJobViaApi, runScriptViaApi } from '../../helpers/jobsApi'
import {
  listConcurrencyGroupsViaApi,
  tryPruneConcurrencyGroupViaApi,
  waitForConcurrencyGroup,
} from '../../helpers/concurrencyApi'

// CG02 — End-to-end: a script with concurrent_limit + concurrency_key
// surfaces a row on /concurrency_groups keyed by the script's concurrency_key
// after it has been run at least once.
//
// Wiring under test:
//  - POST /scripts/create accepts concurrent_limit / concurrency_time_window_s /
//    concurrency_key on the NewScript schema (openapi.yaml L22772-22833).
//  - On the first push under a concurrency_key, the queue inserts a row into
//    concurrency_counter with an empty {} jsonb (windmill-queue/src/jobs.rs
//    L6170-6182, ON CONFLICT DO NOTHING).
//  - GET /api/concurrency_groups/list returns one row per concurrency_counter
//    entry, with total_running = count of keys in job_uuids.
//  - /concurrency_groups (.svelte L78-121) mounts the TableCustom when
//    concurrencyGroups.length > 0; the first <td> is an <a> rendering the raw
//    concurrency_key text.
//
// CE caveat: on Windmill OSS (which the sandbox stack runs — `CE v1.736.0`
// reported by /api/version), update_concurrency_counter in
// windmill-queue/src/jobs_oss.rs is a NO-OP — see L12-24 cfg(not(feature =
// "private")) — so job_uuids is never populated and total_running is
// permanently 0 for every key. The CE-feasible invariant is therefore "the
// row REGISTERS in /list after a job has run under the key" (which is what
// the page's TableCustom mount predicate also tests). The full
// queue-and-back-pressure behaviour (a second concurrent run actually
// blocking on the dispatcher) is EE-only and out of scope here.

test.describe('@flow @feature:concurrency-groups @worker CG02 — Concurrent_limit script surfaces row', () => {
  test('row keyed by the script concurrency_key appears in /list and on /concurrency_groups', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `cg02-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30)
    const scriptPath = `u/admin/${slug}`
    // concurrency_key MUST avoid '/' so the prune URL path-segment is clean,
    // and we inject the slug so parallel test workers can't collide on the
    // concurrency_counter row. '-' is replaced with '_' because some database
    // identifiers / display contexts treat the dash differently.
    const concurrencyKey = `cg02_${slug.replace(/-/g, '_')}`
    const jobIds: string[] = []

    try {
      // Belt-and-braces: clear any leftover artefacts from a previous run.
      await tryDeleteScriptViaApi(request, auth, scriptPath)
      await tryPruneConcurrencyGroupViaApi(request, auth, concurrencyKey)

      // Deploy the script. The slug appears inside the body so the script
      // hash is unique per test run (Windmill content-addresses script hashes,
      // and re-deploying byte-identical content can elide the create — see
      // scripts.rs auto_parent logic).
      await createScriptViaApi(request, auth, {
        path: scriptPath,
        language: 'python3',
        content: `import time\n\ndef main():\n    # ${slug}\n    time.sleep(3)\n    return '${slug}'\n`,
        summary: `CG02 ${slug}`,
        concurrent_limit: 1,
        concurrency_time_window_s: 30,
        concurrency_key: concurrencyKey,
      })

      // Kick off two runs. On EE the second would queue behind the first;
      // on CE both run immediately (update_concurrency_counter no-ops), but
      // EITHER way the FIRST push under this concurrency_key inserts the
      // concurrency_counter row that drives the /list endpoint and the
      // /concurrency_groups page render. runScriptViaApi retries on the 404
      // path-resolver race after scripts/create (helpers/jobsApi.ts L20-35).
      const j1 = await runScriptViaApi(request, auth, { path: scriptPath, args: {} })
      const j2 = await runScriptViaApi(request, auth, { path: scriptPath, args: {} })
      jobIds.push(j1, j2)
      expect(j1, 'first run returns a job uuid').toMatch(/^[0-9a-f-]{30,}$/i)
      expect(j2, 'second run returns a job uuid').toMatch(/^[0-9a-f-]{30,}$/i)

      // Poll /list until our row REGISTERS in concurrency_counter. We do NOT
      // require total_running>=1 because (a) on CE the dispatcher is a
      // no-op and never bumps job_uuids; (b) even on EE the row is decremented
      // the instant the job completes, so a fast worker may have already
      // drained it by the time we observe. The load-bearing invariant for
      // this page is "a row keyed by my concurrency_key exists at all" —
      // exactly what /concurrency_groups renders (it mounts the TableCustom
      // when length>0 regardless of total_running).
      const found = await waitForConcurrencyGroup(request, auth, concurrencyKey, {
        timeoutMs: 30_000,
        intervalMs: 200,
        minRunning: 0,
      })
      expect(found, `expected /concurrency_groups/list to contain key='${concurrencyKey}'`).toBeDefined()
      expect(found!.concurrency_key).toBe(concurrencyKey)

      // UI observation — navigate, wait for the TableCustom to mount, then
      // assert the column headers + our concurrency_key text.
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/concurrency_groups`)
      await expect(page).toHaveTitle(/Concurrency groups/i, { timeout: 30_000 })
      await expect(
        page.getByRole('heading', { name: /^Concurrency Groups$/, level: 1 }),
      ).toBeVisible({ timeout: 30_000 })

      // Column header invariants from the walk: ['Concurrency key', 'Jobs running', ''].
      // Scope to <th> nodes so we don't false-positive on body cells (the
      // first column's <a> also contains the literal text 'Concurrency key'
      // if the key happens to include it).
      await expect(
        page.locator('th').filter({ hasText: /^Concurrency key$/ }).first(),
      ).toBeVisible({ timeout: 30_000 })
      await expect(
        page.locator('th').filter({ hasText: /^Jobs running$/ }).first(),
      ).toBeVisible({ timeout: 30_000 })

      // The first <td> of our row is an <a> with the concurrency_key as text.
      // We scope to a link rather than a cell to avoid accidentally matching
      // any other body-text (e.g. nav). The auto-poll fires every 2s so a
      // longer timeout absorbs the worst-case delay between API observation
      // and UI render.
      await expect(
        page.getByRole('link', { name: concurrencyKey }).first(),
      ).toBeVisible({ timeout: 30_000 })
    } finally {
      // Cancel each queued job so the prune in tryPrune... can succeed. The
      // catch swallows 404 from a job that finished naturally between observation
      // and cancellation.
      for (const id of jobIds) {
        await cancelJobViaApi(request, auth, id).catch(() => {})
      }
      await tryPruneConcurrencyGroupViaApi(request, auth, concurrencyKey).catch(() => {})
      await tryDeleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    }
  })
})
