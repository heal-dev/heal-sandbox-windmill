import type { APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from '../../config'
import type { WsAuth } from './workspaceApi'

const wid = SEED.workspace.id

export const createScriptViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: { path: string; language: 'python3' | 'bun'; content: string; summary?: string },
): Promise<string> => {
  const body = {
    path: args.path,
    summary: args.summary ?? '',
    description: '',
    content: args.content,
    schema: { type: 'object', properties: {}, required: [], $schema: 'https://json-schema.org/draft/2020-12/schema' },
    is_template: false,
    language: args.language,
    kind: 'script',
  }
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
