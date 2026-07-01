import type { APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from '../../config'
import type { WsAuth } from './workspaceApi'

const wid = SEED.workspace.id

// Backend draft kinds the /global_drafts page enumerates
// (windmill-common/src/user_drafts.rs UserDraftItemKind).
// We only exercise 'script' from the test surface — the page is kind-agnostic
// and a script-kind draft is enough to assert listing + delete chrome.
export type DraftKind =
  | 'script'
  | 'flow'
  | 'raw_app'
  | 'trigger_schedule'
  | 'resource'
  | 'variable'

export type DraftListRow = {
  kind: DraftKind
  path: string
  summary?: string
  draft_path?: string
  draft_only: boolean
  legacy_draft: boolean
  created_at: string
  draft_users?: Array<{ username: string | null }>
  can_write: boolean
  mine: boolean
}

// POST /api/w/<wid>/drafts/update/<kind>/<path> with { value: <json> } upserts
// the authed user's draft at (kind, path). value=null deletes it (own-discard
// skips the write-permission gate — see drafts.rs L286-289). Returns the
// SaveDraftResponse { status: 'saved'|'conflict', current_timestamp }.
export const createDraftViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: {
    kind: DraftKind
    path: string
    // The draft value shape is kind-specific (the page only renders
    // metadata: kind + path + summary). For a script-kind draft any object
    // resembling NewScript works — we only need summary + content for the
    // home-page banner / list endpoint to surface it.
    value: Record<string, unknown>
  },
): Promise<{ status: 'saved' | 'conflict'; current_timestamp: string }> => {
  const res = await request.post(
    `${API_BASE}/w/${wid}/drafts/update/${args.kind}/${args.path}`,
    {
      headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
      data: { value: args.value },
    },
  )
  if (!res.ok()) {
    throw new Error(`createDraftViaApi failed: ${res.status()} ${await res.text()}`)
  }
  return (await res.json()) as { status: 'saved' | 'conflict'; current_timestamp: string }
}

// Same endpoint, value=null → row delete. The update_draft handler treats a
// null value as a delete and is idempotent: if no row is present the response
// is still { status: 'saved' } with the server's now() timestamp.
export const deleteDraftViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: { kind: DraftKind; path: string },
): Promise<void> => {
  const res = await request.post(
    `${API_BASE}/w/${wid}/drafts/update/${args.kind}/${args.path}`,
    {
      headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
      data: { value: null },
    },
  )
  if (!res.ok()) {
    throw new Error(`deleteDraftViaApi failed: ${res.status()} ${await res.text()}`)
  }
}

// Defensive: never throws. Used in setup AND finally so a leftover draft from
// a previous run can't make today's create fail (drafts/update is upsert so
// it does NOT actually fail on a duplicate, but the same pattern is used by
// every other helper and keeps the test boilerplate uniform).
export const tryDeleteDraftViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: { kind: DraftKind; path: string },
): Promise<void> => {
  await deleteDraftViaApi(request, auth, args).catch(() => {})
}

// GET /api/w/<wid>/drafts/list — every draft for the authed user across all
// kinds. The /global_drafts page consumes this through DraftService.listDrafts.
// We expose it as a helper so the spec can sanity-check the row shape before
// asserting the rendered DOM.
export const listDraftsViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
): Promise<DraftListRow[]> => {
  const res = await request.get(`${API_BASE}/w/${wid}/drafts/list`, {
    headers: { Cookie: auth.cookie },
  })
  if (!res.ok()) {
    throw new Error(`listDraftsViaApi failed: ${res.status()} ${await res.text()}`)
  }
  return (await res.json()) as DraftListRow[]
}
