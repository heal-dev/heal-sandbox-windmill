import type { APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from '../../config'
import type { WsAuth } from './workspaceApi'

const wid = SEED.workspace.id

// FlowValue shape — { modules: FlowModule[], ... }. See
// windmill/backend/windmill-types/src/flows.rs (FlowValue around line 187,
// FlowModuleValue::RawScript around 931, NewFlow around 117).
export type FlowValue = {
  modules: Array<Record<string, unknown>>
  failure_module?: Record<string, unknown>
  preprocessor_module?: Record<string, unknown>
}

export type CreateFlowArgs = {
  path: string
  summary?: string
  description?: string
  value: FlowValue
  schema?: Record<string, unknown>
  draft_only?: boolean
}

const defaultSchema = {
  type: 'object',
  properties: {},
  required: [],
  $schema: 'https://json-schema.org/draft/2020-12/schema',
}

// Backend route: POST /api/w/<wid>/flows/create
// (windmill/backend/windmill-api-flows/src/flows.rs line 64 + NewFlow at
// windmill/backend/windmill-types/src/flows.rs:117). Response is plain text
// (a short status string), so we just check ok().
export const createFlowViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: CreateFlowArgs,
): Promise<void> => {
  const body = {
    path: args.path,
    summary: args.summary ?? '',
    description: args.description ?? '',
    value: args.value,
    schema: args.schema ?? defaultSchema,
    ...(args.draft_only !== undefined ? { draft_only: args.draft_only } : {}),
  }
  const res = await request.post(`${API_BASE}/w/${wid}/flows/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: body,
  })
  if (!res.ok()) {
    throw new Error(`createFlowViaApi failed: ${res.status()} ${await res.text()}`)
  }
}

// Backend route: POST /api/w/<wid>/flows/update/<path>
// (windmill/backend/windmill-api-flows/src/flows.rs line 65).
export const updateFlowViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
  args: { path?: string; summary?: string; description?: string; value: FlowValue; schema?: Record<string, unknown> },
): Promise<void> => {
  const body = {
    path: args.path ?? path,
    summary: args.summary ?? '',
    description: args.description ?? '',
    value: args.value,
    schema: args.schema ?? defaultSchema,
  }
  const res = await request.post(`${API_BASE}/w/${wid}/flows/update/${path}`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: body,
  })
  if (!res.ok()) {
    throw new Error(`updateFlowViaApi failed: ${res.status()} ${await res.text()}`)
  }
}

// Backend route: DELETE /api/w/<wid>/flows/delete/<path>
// (windmill/backend/windmill-api-flows/src/flows.rs line 67 — note DELETE,
// not POST; confirmed against openapi.yaml line 10138).
export const deleteFlowViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
): Promise<void> => {
  await request.delete(`${API_BASE}/w/${wid}/flows/delete/${path}`, {
    headers: { Cookie: auth.cookie },
  })
}

// Defensive: clear any leftover flow at this path before a test create.
export const tryDeleteFlowViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
): Promise<void> => {
  await deleteFlowViaApi(request, auth, path).catch(() => {})
}

// Backend route: POST /api/w/<wid>/jobs/run/f/<path>
// Mirrors jobsApi.ts:runScriptViaApi's 404-retry shim — immediately after
// flows/create returns 200, the run-by-path resolver can briefly 404 with
// "flow not found" while the new row propagates.
export const runFlowViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
  args?: Record<string, unknown>,
): Promise<string> => {
  const deadline = Date.now() + 15_000
  let lastStatus = 0
  let lastBody = ''
  while (Date.now() < deadline) {
    const res = await request.post(`${API_BASE}/w/${wid}/jobs/run/f/${path}`, {
      headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
      data: args ?? {},
    })
    if (res.ok()) {
      return (await res.text()).trim().replace(/^"|"$/g, '')
    }
    lastStatus = res.status()
    lastBody = await res.text()
    if (lastStatus !== 404) break
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`runFlowViaApi failed: ${lastStatus} ${lastBody}`)
}

// Helper: build a 2-step python flow value where step `a` returns a tagged
// string (uses `slug` so the content hash is unique per test) and step `b`
// echoes step `a`'s result via input_transforms.
export const twoStepEchoFlowValue = (slug: string, payload = 'hello windmill'): FlowValue => ({
  modules: [
    {
      id: 'a',
      value: {
        type: 'rawscript',
        language: 'python3',
        content: `def main():\n    # ns: ${slug}\n    return '${payload}'\n`,
        input_transforms: {},
      },
    },
    {
      id: 'b',
      value: {
        type: 'rawscript',
        language: 'python3',
        content: `def main(prev):\n    # ns: ${slug}\n    return prev\n`,
        input_transforms: {
          prev: { type: 'javascript', expr: 'results.a' },
        },
      },
    },
  ],
})

export const oneStepFlowValue = (slug: string, payload = 'hello windmill'): FlowValue => ({
  modules: [
    {
      id: 'a',
      value: {
        type: 'rawscript',
        language: 'python3',
        content: `def main():\n    # ns: ${slug}\n    return '${payload}'\n`,
        input_transforms: {},
      },
    },
  ],
})
