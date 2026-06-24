import type { APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from '../../config'
import type { WsAuth } from './workspaceApi'

const wid = SEED.workspace.id

// Backend wiring summary (see windmill/backend/windmill-api-groups/src/folders.rs):
//   GET    /api/w/<wid>/folders/list
//   GET    /api/w/<wid>/folders/listnames
//   POST   /api/w/<wid>/folders/create               body: { name, display_name?, summary?, owners?, extra_perms? }
//   GET    /api/w/<wid>/folders/get/{name}
//   GET    /api/w/<wid>/folders/exists/{name}
//   POST   /api/w/<wid>/folders/update/{name}        body: UpdateFolder
//   GET    /api/w/<wid>/folders/getusage/{name}
//   DELETE /api/w/<wid>/folders/delete/{name}
//   POST   /api/w/<wid>/folders/addowner/{name}      body: { owner, write? }
//   POST   /api/w/<wid>/folders/removeowner/{name}   body: { owner, write? }
//
// Folder-name constraint (folders.rs VALID_FOLDER_NAME): ^[a-zA-Z_0-9-]+$.
// Owner constraint (validate_owner): alphanumeric, underscore, hyphen, or slash.
// The admin@windmill.dev superadmin's permissioned_as in the 'admins' seed
// workspace is the literal email (username_to_permissioned_as keeps strings
// containing '@' verbatim), not 'u/admin' — confirmed by GET /folders/get/.
//
// Conflict semantics: POST /folders/create on an existing name returns 400
// "Folder '<name>' already exists in workspace '<wid>'" (or the not-allowed
// variant when the requester is not an owner of the existing folder).

export type FolderRow = {
  workspace_id: string
  name: string
  display_name: string
  owners: string[]
  extra_perms: Record<string, boolean>
  summary: string | null
  created_by: string | null
  edited_at: string | null
  default_permissioned_as: unknown[]
  labels?: string[] | null
}

export type CreateFolderArgs = {
  name: string
  display_name?: string
  summary?: string
  owners?: string[]
  extra_perms?: Record<string, boolean>
}

export const createFolderViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: CreateFolderArgs,
): Promise<void> => {
  const body: Record<string, unknown> = { name: args.name }
  if (args.display_name !== undefined) body.display_name = args.display_name
  if (args.summary !== undefined) body.summary = args.summary
  if (args.owners !== undefined) body.owners = args.owners
  if (args.extra_perms !== undefined) body.extra_perms = args.extra_perms
  const res = await request.post(`${API_BASE}/w/${wid}/folders/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: body,
  })
  if (!res.ok()) {
    throw new Error(`createFolderViaApi failed: ${res.status()} ${await res.text()}`)
  }
}

export const deleteFolderViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  name: string,
): Promise<void> => {
  const res = await request.delete(`${API_BASE}/w/${wid}/folders/delete/${name}`, {
    headers: { Cookie: auth.cookie },
  })
  if (!res.ok() && res.status() !== 404) {
    throw new Error(`deleteFolderViaApi failed: ${res.status()} ${await res.text()}`)
  }
}

// Defensive: clear any leftover folder at this name before a test create.
export const tryDeleteFolderViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  name: string,
): Promise<void> => {
  await deleteFolderViaApi(request, auth, name).catch(() => {})
}

export const getFolderViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  name: string,
): Promise<{ ok: boolean; status: number; body: FolderRow | null }> => {
  const res = await request.get(`${API_BASE}/w/${wid}/folders/get/${name}`, {
    headers: { Cookie: auth.cookie },
  })
  let body: FolderRow | null = null
  try {
    body = (await res.json()) as FolderRow
  } catch {
    body = null
  }
  return { ok: res.ok(), status: res.status(), body }
}

export const listFoldersViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
): Promise<FolderRow[]> => {
  const res = await request.get(`${API_BASE}/w/${wid}/folders/list`, {
    headers: { Cookie: auth.cookie },
  })
  if (!res.ok()) return []
  return (await res.json()) as FolderRow[]
}

// Note: `owner` MUST be a fully-prefixed permissioned_as token —
// 'u/<username>', 'g/<group>', or a raw email — NOT a bare username.
// Bare 'admin' would be appended to the owners array literally, which other
// code paths cannot resolve into a real user.
export const addFolderOwnerViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  name: string,
  owner: string,
): Promise<void> => {
  const res = await request.post(`${API_BASE}/w/${wid}/folders/addowner/${name}`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: { owner },
  })
  if (!res.ok()) {
    throw new Error(`addFolderOwnerViaApi failed: ${res.status()} ${await res.text()}`)
  }
}

// Backend treats removeowner with no `write` field as full removal from owners
// (revoke admin), and with `write: true|false` as a downgrade to writer|viewer.
export const removeFolderOwnerViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  name: string,
  owner: string,
  write?: boolean,
): Promise<void> => {
  const data: Record<string, unknown> = { owner }
  if (write !== undefined) data.write = write
  const res = await request.post(`${API_BASE}/w/${wid}/folders/removeowner/${name}`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data,
  })
  if (!res.ok()) {
    throw new Error(`removeFolderOwnerViaApi failed: ${res.status()} ${await res.text()}`)
  }
}

export type FolderUsage = {
  scripts: number
  schedules: number
  flows: number
  apps: number
  resources: number
  variables: number
}

export const getFolderUsageViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  name: string,
): Promise<FolderUsage> => {
  const res = await request.get(`${API_BASE}/w/${wid}/folders/getusage/${name}`, {
    headers: { Cookie: auth.cookie },
  })
  if (!res.ok()) {
    throw new Error(`getFolderUsageViaApi failed: ${res.status()} ${await res.text()}`)
  }
  return (await res.json()) as FolderUsage
}
