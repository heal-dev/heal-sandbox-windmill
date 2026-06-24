import type { APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from '../../config'
import type { WsAuth } from './workspaceApi'

const wid = SEED.workspace.id

// Backend route: POST /api/w/<wid>/apps/create
// (windmill/backend/windmill-api/src/apps.rs line 110, handler create_app L1749).
// CreateApp shape (apps.rs L316):
//   { path, summary, value: AppValue, policy: Policy, deployment_message?, custom_path?, labels? }
// Policy.execution_mode is required by the backend (publisher | viewer | anonymous).
//
// AppValue is open-ended (sqlx::types::Json<Box<RawValue>>) — backend never
// inspects it on create. The minimal shape derived from
// windmill/cli/test/mixed_case_paths.test.ts createApp() helper:
//   { grid: [], hiddenInlineScripts: [], css: {}, norefreshbar: false }
// is enough for the row to be persisted and rendered by InWorkspaceAppViewer
// at /apps/get/<path>.

export type AppValue = Record<string, unknown>

export type AppPolicy = {
  execution_mode: 'publisher' | 'viewer' | 'anonymous'
  triggerables?: Record<string, unknown>
  on_behalf_of?: string | null
  on_behalf_of_email?: string | null
}

export type CreateAppArgs = {
  path: string
  summary?: string
  value?: AppValue
  policy?: AppPolicy
}

// Minimal in-workspace app value the backend accepts and the viewer renders
// without runtime errors. `grid: []` keeps the surface empty; the viewer's
// chrome (the parent /apps/get/<path> Svelte page) still mounts and the
// underlying app row + version are persisted, which is what the tests assert.
export const minimalAppValue = (slug: string): AppValue => ({
  grid: [],
  hiddenInlineScripts: [],
  unusedInlineScripts: [],
  fullscreen: false,
  // The `description` field is not part of CreateApp, but the AppValue
  // shape is open — wedging the slug here keeps the JSON-encoded value's
  // content hash unique per test, sidestepping the cross-test collision
  // gotcha called out in the brief.
  description: `ns:${slug}`,
  css: {},
  norefreshbar: false,
})

// Build a single-button AppValue that, when clicked in the viewer, runs the
// supplied inline Python script and returns the tagged payload. Used by A02
// so the test has something to assert against beyond "the page mounted".
export const buttonAppValue = (slug: string, payload = `hello-${slug}`): AppValue => ({
  grid: [
    {
      id: 'a',
      x: 0,
      y: 0,
      w: 4,
      h: 1,
      data: {
        type: 'buttoncomponent',
        id: 'a',
        configuration: {
          label: { type: 'static', value: `Run ${slug}` },
        },
        componentInput: {
          type: 'runnable',
          fieldType: 'any',
          fields: {},
          runnable: {
            type: 'runnableByName',
            name: `run-${slug}`,
            inlineScript: {
              content: `def main():\n    # ns: ${slug}\n    return '${payload}'\n`,
              language: 'python3',
              schema: {
                type: 'object',
                properties: {},
                required: [],
                $schema: 'https://json-schema.org/draft/2020-12/schema',
              },
            },
          },
        },
      },
    },
  ],
  hiddenInlineScripts: [],
  unusedInlineScripts: [],
  fullscreen: false,
  description: `ns:${slug}`,
  css: {},
  norefreshbar: false,
})

const defaultPolicy: AppPolicy = { execution_mode: 'viewer' }

export const createAppViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: CreateAppArgs,
): Promise<string> => {
  const body = {
    path: args.path,
    summary: args.summary ?? '',
    value: args.value ?? minimalAppValue(args.path),
    policy: args.policy ?? defaultPolicy,
  }
  const res = await request.post(`${API_BASE}/w/${wid}/apps/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: body,
  })
  if (!res.ok()) {
    throw new Error(`createAppViaApi failed: ${res.status()} ${await res.text()}`)
  }
  return (await res.text()).trim().replace(/^"|"$/g, '')
}

// Backend route: POST /api/w/<wid>/apps/update/<path>
// (windmill/backend/windmill-api/src/apps.rs line 104, handler update_app L2253).
// EditApp shape (apps.rs L334): all fields optional. We re-send path/summary/
// value/policy on every update — matches what the editor's
// utils_draft_deploy.ts deploy path posts.
export type UpdateAppArgs = {
  path?: string
  summary?: string
  value?: AppValue
  policy?: AppPolicy
  deployment_message?: string
}

export const updateAppViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
  args: UpdateAppArgs,
): Promise<void> => {
  const body: Record<string, unknown> = {}
  if (args.path !== undefined) body.path = args.path
  if (args.summary !== undefined) body.summary = args.summary
  if (args.value !== undefined) body.value = args.value
  if (args.policy !== undefined) body.policy = args.policy
  if (args.deployment_message !== undefined) body.deployment_message = args.deployment_message
  const res = await request.post(`${API_BASE}/w/${wid}/apps/update/${path}`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: body,
  })
  if (!res.ok()) {
    throw new Error(`updateAppViaApi failed: ${res.status()} ${await res.text()}`)
  }
}

// Backend route: DELETE /api/w/<wid>/apps/delete/<path>
// (windmill/backend/windmill-api/src/apps.rs line 109, handler delete_app L2092).
export const deleteAppViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
): Promise<void> => {
  await request.delete(`${API_BASE}/w/${wid}/apps/delete/${path}`, {
    headers: { Cookie: auth.cookie },
  })
}

// Defensive: clear any leftover app at this path before a test create.
export const tryDeleteAppViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
): Promise<void> => {
  await deleteAppViaApi(request, auth, path).catch(() => {})
}

// Backend route: GET /api/w/<wid>/apps/get/p/<path>
// (windmill/backend/windmill-api/src/apps.rs line 93, handler get_app L851).
// Response is a WithDraftOverlay<AppWithLastVersion> — the deployed row's
// `summary`, `path`, `value`, `policy`, plus draft overlay metadata. We just
// surface the body / status for tests.
export const getAppViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
): Promise<{ ok: boolean; status: number; body: any }> => {
  const res = await request.get(`${API_BASE}/w/${wid}/apps/get/p/${path}`, {
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

// Backend route: GET /api/w/<wid>/apps/list
// (windmill/backend/windmill-api/src/apps.rs line 91, handler list_apps L390).
export const listAppsViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
): Promise<Array<{ path: string; summary: string }>> => {
  const res = await request.get(`${API_BASE}/w/${wid}/apps/list`, {
    headers: { Cookie: auth.cookie },
  })
  if (!res.ok()) return []
  return (await res.json()) as any
}
