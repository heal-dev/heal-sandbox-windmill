import type { APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from '../../config'
import type { WsAuth } from './workspaceApi'

const wid = SEED.workspace.id

export type AuditLogRow = {
  workspace_id: string
  id: number
  timestamp: string
  username: string
  operation: string
  action_kind: 'Create' | 'Update' | 'Delete' | 'Execute'
  resource: string | null
  parameters: Record<string, unknown> | null
  span?: string | null
}

export type ListAuditLogsParams = {
  per_page?: number
  page?: number
  username?: string
  // backend enum is lowercase ('create' | 'update' | 'delete' | 'execute');
  // capitalised values fail with `invalid input value for enum action_kind` —
  // confirmed against /api/w/admins/audit/list?action_kind=Create.
  action_kind?: 'create' | 'update' | 'delete' | 'execute'
  operation?: string
  resource?: string
  before?: string
  after?: string
}

export const listAuditLogs = async (
  request: APIRequestContext,
  auth: WsAuth,
  params: ListAuditLogsParams = {},
): Promise<AuditLogRow[]> => {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v))
  }
  const url = `${API_BASE}/w/${wid}/audit/list${qs.toString() ? `?${qs}` : ''}`
  const res = await request.get(url, { headers: { Cookie: auth.cookie } })
  if (!res.ok()) {
    throw new Error(`listAuditLogs failed: ${res.status()} ${await res.text()}`)
  }
  return (await res.json()) as AuditLogRow[]
}
