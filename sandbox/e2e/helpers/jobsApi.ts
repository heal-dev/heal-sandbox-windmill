import type { APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from '../../config'
import type { WsAuth } from './workspaceApi'

const wid = SEED.workspace.id

// Backend route: POST /api/w/<wid>/jobs/run/p/<*script_path>
// (windmill/backend/windmill-api/src/jobs.rs lines 173-179)
// Response body is the raw UUID (sometimes wrapped in JSON quotes).
//
// Note: immediately after scripts/create returns 200, run-by-path can return
// 404 "script not found at name <path>" — the script row hasn't been visible
// to the run resolver yet. Retry with a short backoff before surfacing the
// error so suite-time creates don't race the path resolver.
export const runScriptViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: { path: string; args?: Record<string, unknown> },
): Promise<string> => {
  const deadline = Date.now() + 15_000
  let lastStatus = 0
  let lastBody = ''
  while (Date.now() < deadline) {
    const res = await request.post(`${API_BASE}/w/${wid}/jobs/run/p/${args.path}`, {
      headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
      data: args.args ?? {},
    })
    if (res.ok()) {
      return (await res.text()).trim().replace(/^"|"$/g, '')
    }
    lastStatus = res.status()
    lastBody = await res.text()
    if (lastStatus !== 404) break
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`runScriptViaApi failed: ${lastStatus} ${lastBody}`)
}

// Backend route: GET /api/w/<wid>/jobs_u/get/<id>
// (windmill/backend/windmill-api/src/jobs.rs line 390)
// Returns either a QueuedJob (type: "QueuedJob") or a CompletedJob (type: "CompletedJob").
export const getJobViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  jobId: string,
): Promise<{ ok: boolean; status: number; body: any }> => {
  const res = await request.get(`${API_BASE}/w/${wid}/jobs_u/get/${jobId}`, {
    headers: { Cookie: auth.cookie },
  })
  let body: any = null
  try {
    body = await res.json()
  } catch {
    body = await res.text()
  }
  return { ok: res.ok(), status: res.status(), body }
}

// Backend route: GET /api/w/<wid>/jobs_u/completed/get/<id>
// (windmill/backend/windmill-api/src/jobs.rs line 400)
export const getCompletedJobViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  jobId: string,
): Promise<any> => {
  const res = await request.get(`${API_BASE}/w/${wid}/jobs_u/completed/get/${jobId}`, {
    headers: { Cookie: auth.cookie },
  })
  if (!res.ok()) {
    throw new Error(`getCompletedJobViaApi failed: ${res.status()} ${await res.text()}`)
  }
  return await res.json()
}

// Backend route: POST /api/w/<wid>/jobs_u/queue/cancel/<id>
// (windmill/backend/windmill-api/src/jobs.rs line 411)
export const cancelJobViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  jobId: string,
): Promise<void> => {
  const res = await request.post(`${API_BASE}/w/${wid}/jobs_u/queue/cancel/${jobId}`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: {},
  })
  if (!res.ok() && res.status() !== 404) {
    throw new Error(`cancelJobViaApi failed: ${res.status()} ${await res.text()}`)
  }
}

export type WaitOpts = { timeoutMs?: number; intervalMs?: number }

// Poll jobs_u/get/<id> until the response body has type === 'CompletedJob'.
// Returns the completed job body.
export const waitForJobCompletion = async (
  request: APIRequestContext,
  auth: WsAuth,
  jobId: string,
  opts: WaitOpts = {},
): Promise<any> => {
  const timeoutMs = opts.timeoutMs ?? 60_000
  const intervalMs = opts.intervalMs ?? 500
  const deadline = Date.now() + timeoutMs
  let lastBody: any = null
  while (Date.now() < deadline) {
    const { ok, body } = await getJobViaApi(request, auth, jobId)
    if (ok && body && typeof body === 'object' && body.type === 'CompletedJob') {
      return body
    }
    lastBody = body
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(
    `waitForJobCompletion: timed out after ${timeoutMs}ms for ${jobId} (last body: ${JSON.stringify(lastBody)?.slice(0, 200)})`,
  )
}
