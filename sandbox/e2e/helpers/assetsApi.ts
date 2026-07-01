import type { APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from '../../config'
import type { WsAuth } from './workspaceApi'

const ws = SEED.workspace.id

// Mirror of windmill-api-assets/src/lib.rs ListAssetsResponse — only the fields
// the authored flows actually pin. usages[].metadata is omitted (jobs-only).
export type AssetUsage = {
  path: string
  kind: 'script' | 'flow' | 'job'
  access_type?: 'r' | 'w' | 'rw' | null
  columns?: unknown
  created_at?: string
}
export type Asset = {
  path: string
  kind: 's3object' | 'resource' | 'variable' | 'ducklake' | 'datatable' | 'volume'
  usages: AssetUsage[]
  metadata?: { resource_type?: string }
}
export type ListAssetsResponse = { assets: Asset[]; next_cursor?: unknown }

export type ListAssetsOptions = {
  // Substring match (case-insensitive) against asset.path
  assetPath?: string
  // Substring match (case-insensitive) against usage.path / job.runnable_path
  usagePath?: string
  // Comma-joined CSV of asset kinds (server validates against the AssetKind enum)
  assetKinds?: string
  // Exact asset.path match
  path?: string
  // Free-text broad filter (ILIKE on path OR kind)
  broadFilter?: string
  perPage?: number
}

// GET /api/w/<ws>/assets/list — the same endpoint the /assets DataTable polls
// via AssetService.listAssets. Returns the *typed* response so spec tests can
// pin `kind`/`usages` directly instead of indexing into `unknown`.
export const listAssetsViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  opts: ListAssetsOptions = {},
): Promise<ListAssetsResponse> => {
  const qs = new URLSearchParams()
  qs.set('per_page', String(opts.perPage ?? 50))
  if (opts.assetPath !== undefined) qs.set('asset_path', opts.assetPath)
  if (opts.usagePath !== undefined) qs.set('usage_path', opts.usagePath)
  if (opts.assetKinds !== undefined) qs.set('asset_kinds', opts.assetKinds)
  if (opts.path !== undefined) qs.set('path', opts.path)
  if (opts.broadFilter !== undefined) qs.set('broad_filter', opts.broadFilter)
  const res = await request.get(`${API_BASE}/w/${ws}/assets/list?${qs.toString()}`, {
    headers: { Cookie: auth.cookie },
  })
  if (!res.ok()) throw new Error(`assets/list failed: ${res.status()} ${await res.text()}`)
  return (await res.json()) as ListAssetsResponse
}
