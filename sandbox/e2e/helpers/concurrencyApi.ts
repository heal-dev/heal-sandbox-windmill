import type { APIRequestContext } from '@playwright/test'
import { API_BASE } from '../../config'
import type { WsAuth } from './workspaceApi'

// Backend: windmill-api-jobs/src/concurrency_groups.rs.
// The list / prune endpoints live under the GLOBAL service (no /w/<wid>/
// prefix) — see global_service() L25-30. They require admin auth.

export type ConcurrencyGroup = {
  concurrency_key: string
  total_running: number
}

// GET /api/concurrency_groups/list — admin-only (require_admin gate, L46).
export const listConcurrencyGroupsViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
): Promise<ConcurrencyGroup[]> => {
  const res = await request.get(`${API_BASE}/concurrency_groups/list`, {
    headers: { Cookie: auth.cookie },
  })
  if (!res.ok()) {
    throw new Error(`listConcurrencyGroupsViaApi failed: ${res.status()} ${await res.text()}`)
  }
  return (await res.json()) as ConcurrencyGroup[]
}

// DELETE /api/concurrency_groups/prune/{*concurrency_key} — admin-only;
// fails (500) with "Concurrency group is currently in use, unable to remove
// it. Retry later." when total_running > 0 (L85-90).
export const pruneConcurrencyGroupViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  concurrencyKey: string,
): Promise<{ ok: boolean; status: number; body: string }> => {
  const res = await request.delete(
    `${API_BASE}/concurrency_groups/prune/${encodeURIComponent(concurrencyKey)}`,
    { headers: { Cookie: auth.cookie } },
  )
  return { ok: res.ok(), status: res.status(), body: await res.text() }
}

// Defensive cleanup — used in `finally` blocks. Polls until total_running is
// 0 (or the group has disappeared) and then attempts a prune. Returns silently
// on timeout so test-teardown never throws past the actual failure.
export const tryPruneConcurrencyGroupViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  concurrencyKey: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> => {
  const timeoutMs = opts.timeoutMs ?? 20_000
  const intervalMs = opts.intervalMs ?? 500
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const all = await listConcurrencyGroupsViaApi(request, auth)
      const mine = all.find((g) => g.concurrency_key === concurrencyKey)
      if (!mine) return
      if (mine.total_running === 0) {
        await pruneConcurrencyGroupViaApi(request, auth, concurrencyKey)
        return
      }
    } catch {
      return
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

// Polling helper — waits until a group with the given key REGISTERS in
// /list (the row exists in concurrency_counter), regardless of how many
// jobs are inflight at the moment of the poll. Returns the most recent
// snapshot (matching or not) so callers can assert on it. When `minRunning`
// is provided the wait is stricter — it loops until the row exists AND
// total_running >= minRunning, which is a race-y signal on a fast worker
// (a job's UUID is removed from job_uuids the instant it completes).
export const waitForConcurrencyGroup = async (
  request: APIRequestContext,
  auth: WsAuth,
  concurrencyKey: string,
  opts: { timeoutMs?: number; intervalMs?: number; minRunning?: number } = {},
): Promise<ConcurrencyGroup | undefined> => {
  const timeoutMs = opts.timeoutMs ?? 20_000
  const intervalMs = opts.intervalMs ?? 200
  const minRunning = opts.minRunning ?? 0
  const deadline = Date.now() + timeoutMs
  let last: ConcurrencyGroup | undefined
  while (Date.now() < deadline) {
    const all = await listConcurrencyGroupsViaApi(request, auth)
    const cur = all.find((g) => g.concurrency_key === concurrencyKey)
    if (cur) {
      // Remember the highest total_running we observe — the dispatcher
      // drains job_uuids fast, so a single point sample may underreport the
      // peak. Tests that want to assert the row was ever-inflight should
      // read the returned snapshot's total_running field.
      if (!last || cur.total_running > last.total_running) last = cur
      if (cur.total_running >= minRunning) return last
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return last
}
