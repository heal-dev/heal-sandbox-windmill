import type { APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from '../../config'
import type { WsAuth } from './workspaceApi'

const wid = SEED.workspace.id

export const createScriptViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: {
    path: string
    language: 'python3' | 'bun'
    content: string
    summary?: string
    // Optional concurrency knobs (NewScript schema in openapi.yaml L22772-22833):
    // when concurrent_limit is set, the worker enforces it against either the
    // explicit concurrency_key or an auto-generated key. concurrency_time_window_s
    // sets the rolling window over which the limit applies.
    concurrent_limit?: number
    concurrency_time_window_s?: number
    concurrency_key?: string
  },
): Promise<string> => {
  const body: Record<string, unknown> = {
    path: args.path,
    summary: args.summary ?? '',
    description: '',
    content: args.content,
    schema: { type: 'object', properties: {}, required: [], $schema: 'https://json-schema.org/draft/2020-12/schema' },
    is_template: false,
    language: args.language,
    kind: 'script',
  }
  if (args.concurrent_limit !== undefined) body.concurrent_limit = args.concurrent_limit
  if (args.concurrency_time_window_s !== undefined) body.concurrency_time_window_s = args.concurrency_time_window_s
  if (args.concurrency_key !== undefined) body.concurrency_key = args.concurrency_key
  const res = await request.post(`${API_BASE}/w/${wid}/scripts/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: body,
  })
  if (!res.ok()) {
    throw new Error(`createScriptViaApi failed: ${res.status()} ${await res.text()}`)
  }
  return (await res.text()).trim().replace(/^"|"$/g, '')
}

export const deleteScriptViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
): Promise<void> => {
  await request.post(`${API_BASE}/w/${wid}/scripts/delete/p/${path}`, {
    headers: { Cookie: auth.cookie },
  })
}

// Defensive: clear any leftover script at this path before a test create.
export const tryDeleteScriptViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
): Promise<void> => {
  await deleteScriptViaApi(request, auth, path).catch(() => {})
}
