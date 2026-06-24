import type { APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from '../../config'
import type { WsAuth } from './workspaceApi'

const wid = SEED.workspace.id

// Backend wiring summary (see windmill/backend/windmill-api/src/triggers/handler.rs):
//   .nest(HttpTrigger::ROUTE_PREFIX, complete_trigger_routes(HttpTrigger))
// with ROUTE_PREFIX = "/http_triggers" (windmill-trigger-http/src/handler.rs L386).
//
// The generic CRUD router lives at windmill-trigger/src/handler.rs L449-457:
//   POST   /create
//   GET    /list
//   GET    /get/{*path}
//   POST   /update/{*path}
//   DELETE /delete/{*path}
//   GET    /exists/{*path}
//   POST   /setmode/{*path}  body: { mode: 'enabled' | 'disabled' | 'suspended', force?: bool }
//
// Conflict semantics (windmill-trigger-http/src/handler.rs route_path_key_exists):
// two rows colliding on (route_path_key, http_method, workspace scope) — backend
// returns 400 "A route already exists with this path" via check_if_route_exist.

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'
export type RequestType = 'sync' | 'async' | 'sync_sse'
export type TriggerMode = 'enabled' | 'disabled' | 'suspended'
export type AuthenticationMethod =
  | 'none'
  | 'windmill'
  | 'api_key'
  | 'basic_http'
  | 'custom_script'
  | 'signature'

export type CreateHttpRouteArgs = {
  path: string
  route_path: string
  http_method?: HttpMethod
  script_path?: string
  flow_path?: string
  is_flow?: boolean
  summary?: string
  description?: string
  request_type?: RequestType
  authentication_method?: AuthenticationMethod
  workspaced_route?: boolean
  enabled?: boolean
  wrap_body?: boolean
  raw_string?: boolean
  is_static_website?: boolean
}

const buildCreateBody = (args: CreateHttpRouteArgs) => {
  const is_flow = args.is_flow ?? !!args.flow_path
  const script_path = is_flow ? (args.flow_path ?? '') : (args.script_path ?? '')
  return {
    path: args.path,
    summary: args.summary ?? '',
    description: args.description ?? '',
    script_path,
    is_flow,
    route_path: args.route_path,
    http_method: args.http_method ?? 'post',
    request_type: args.request_type ?? 'sync',
    authentication_method: args.authentication_method ?? 'none',
    // HTTP routes always run workspace-scoped at runtime in this sandbox
    // (HTTP_ROUTE_WORKSPACED_ROUTE is irrelevant — we explicitly set true so
    // tests don't trip the non-admin instance-wide-route check and so the
    // canonical URL stays /api/r/<wid>/<route_path>).
    workspaced_route: args.workspaced_route ?? true,
    is_static_website: args.is_static_website ?? false,
    wrap_body: args.wrap_body ?? false,
    raw_string: args.raw_string ?? false,
    static_asset_config: null,
    is_async: (args.request_type ?? 'sync') === 'async',
    mode: (args.enabled ?? true) ? 'enabled' : 'disabled',
    enabled: args.enabled ?? true,
  }
}

export const createHttpRouteViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: CreateHttpRouteArgs,
): Promise<string> => {
  const res = await request.post(`${API_BASE}/w/${wid}/http_triggers/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: buildCreateBody(args),
  })
  if (!res.ok()) {
    throw new Error(`createHttpRouteViaApi failed: ${res.status()} ${await res.text()}`)
  }
  return (await res.text()).trim().replace(/^"|"$/g, '')
}

// Mirror tryCreateScheduleViaApi: return the raw response so tests can assert
// rejections (e.g. T02.S2 path/method conflict) instead of throwing.
export const tryCreateHttpRouteViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: CreateHttpRouteArgs,
): Promise<{ ok: boolean; status: number; body: string }> => {
  const res = await request.post(`${API_BASE}/w/${wid}/http_triggers/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: buildCreateBody(args),
  })
  return { ok: res.ok(), status: res.status(), body: await res.text() }
}

export const updateHttpRouteViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
  args: CreateHttpRouteArgs,
): Promise<void> => {
  const res = await request.post(`${API_BASE}/w/${wid}/http_triggers/update/${path}`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: buildCreateBody(args),
  })
  if (!res.ok()) {
    throw new Error(`updateHttpRouteViaApi failed: ${res.status()} ${await res.text()}`)
  }
}

export const getHttpRouteViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
): Promise<{ ok: boolean; status: number; body: any }> => {
  const res = await request.get(`${API_BASE}/w/${wid}/http_triggers/get/${path}`, {
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

export const deleteHttpRouteViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
): Promise<void> => {
  await request.delete(`${API_BASE}/w/${wid}/http_triggers/delete/${path}`, {
    headers: { Cookie: auth.cookie },
  })
}

// Defensive: clear any leftover route at this path before a test create.
export const tryDeleteHttpRouteViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
): Promise<void> => {
  await deleteHttpRouteViaApi(request, auth, path).catch(() => {})
}

// Backend exposes `/setmode/{path}` with body { mode, force? }. There is no
// dedicated `/setenabled` route on the HTTP trigger surface — translate the
// boolean to a TriggerMode for the caller (UI label says enable/disable).
export const setHttpRouteEnabledViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
  enabled: boolean,
): Promise<void> => {
  const res = await request.post(`${API_BASE}/w/${wid}/http_triggers/setmode/${path}`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: { mode: enabled ? 'enabled' : 'disabled' },
  })
  if (!res.ok()) {
    throw new Error(`setHttpRouteEnabledViaApi failed: ${res.status()} ${await res.text()}`)
  }
}

export const listHttpRoutesViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
): Promise<Array<{ path: string; route_path: string; http_method: HttpMethod; mode: TriggerMode; script_path: string; is_flow: boolean }>> => {
  const res = await request.get(`${API_BASE}/w/${wid}/http_triggers/list`, {
    headers: { Cookie: auth.cookie },
  })
  if (!res.ok()) return []
  return (await res.json()) as any
}
