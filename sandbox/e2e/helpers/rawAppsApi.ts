import type { APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from '../../config'
import type { WsAuth } from './workspaceApi'
import { deleteAppViaApi, getAppViaApi } from './appsApi'

const wid = SEED.workspace.id

// Raw apps share the `app` table with low-code apps; the `app_version.raw_app`
// boolean is the only differentiator. CRUD endpoints live on the apps router
// (windmill/backend/windmill-api/src/apps.rs L89-130) and use multipart bodies:
//
//   POST   /api/w/<wid>/apps/create_raw           — multipart: { app, js, css? }
//   POST   /api/w/<wid>/apps/update_raw/<path>    — multipart: { app, js, css? }
//   DELETE /api/w/<wid>/apps/delete/<path>        — shared with low-code apps
//   GET    /api/w/<wid>/apps/get/p/<path>         — shared (raw_app: true in body)
//
// The `app` JSON field for create is CreateApp (path, summary, value, policy
// REQUIRED with execution_mode); for update it is EditApp (all fields optional,
// but `value` MUST be supplied for raw-app updates — otherwise the multipart
// handler tries to re-upload the JS bundle against the SAME app_version_id
// and trips the `app_bundles_pkey` unique constraint).

export type RawAppFile = { code: string }
export type RawAppValue = {
  files: Record<string, RawAppFile>
  runnables: Record<string, unknown>
  // Description is not part of the schema but the value blob is open JSON —
  // injecting the slug here keeps the JSON content hash unique per test so a
  // re-deploy is never a no-op (mirrors the gotcha called out for low-code apps).
  description?: string
}

export type RawAppPolicy = {
  execution_mode: 'publisher' | 'viewer' | 'anonymous'
  on_behalf_of?: string | null
  on_behalf_of_email?: string | null
}

export type CreateRawAppArgs = {
  path: string
  summary?: string
  value?: RawAppValue
  policy?: RawAppPolicy
  /** JS bundle uploaded as the multipart `js` part. Required by the backend. */
  js?: string
  /** Optional CSS bundle. */
  css?: string
}

export type UpdateRawAppArgs = {
  path?: string
  summary?: string
  /** MUST be set or the multipart handler re-uses the prior version id and
   *  the JS upload fails on the app_bundles primary key. */
  value?: RawAppValue
  policy?: RawAppPolicy
  js?: string
  css?: string
  deployment_message?: string
}

// Minimal raw-app value the backend accepts. The HTML is wrapped at render time
// by the RawAppPreview iframe so the literal index.html bytes round-trip via
// /apps/get/p/<path>, which lets the test assert the slug-stamped markup is the
// deployed bytes without driving the iframe (forbidden by the brief).
export const minimalRawAppValue = (slug: string, body = `<h1>hello-${slug}</h1>`): RawAppValue => ({
  files: {
    'index.html': {
      code: `<!doctype html><html><head><title>raw-app-${slug}</title></head><body>${body}</body></html>`,
    },
    'index.js': { code: `console.log('raw-app-${slug}')` },
  },
  runnables: {},
  description: `ns:${slug}`,
})

const defaultPolicy: RawAppPolicy = { execution_mode: 'viewer' }

const buildMultipart = (
  appJson: Record<string, unknown>,
  js: string,
  css: string | undefined,
): { multipart: Record<string, any> } => {
  const multipart: Record<string, any> = {
    app: { name: 'app.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(appJson)) },
    js: { name: 'index.js', mimeType: 'application/javascript', buffer: Buffer.from(js) },
  }
  if (css !== undefined) {
    multipart.css = { name: 'index.css', mimeType: 'text/css', buffer: Buffer.from(css) }
  }
  return { multipart }
}

export const createRawAppViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: CreateRawAppArgs,
): Promise<string> => {
  const appJson: Record<string, unknown> = {
    path: args.path,
    summary: args.summary ?? '',
    value: args.value ?? minimalRawAppValue(args.path),
    policy: args.policy ?? defaultPolicy,
  }
  const { multipart } = buildMultipart(
    appJson,
    args.js ?? `console.log('raw-app-${args.path}')`,
    args.css,
  )
  const res = await request.post(`${API_BASE}/w/${wid}/apps/create_raw`, {
    headers: { Cookie: auth.cookie },
    multipart,
  })
  if (!res.ok()) {
    throw new Error(`createRawAppViaApi failed: ${res.status()} ${await res.text()}`)
  }
  return (await res.text()).trim().replace(/^"|"$/g, '')
}

export const updateRawAppViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
  args: UpdateRawAppArgs,
): Promise<void> => {
  const appJson: Record<string, unknown> = {}
  if (args.path !== undefined) appJson.path = args.path
  if (args.summary !== undefined) appJson.summary = args.summary
  if (args.value !== undefined) appJson.value = args.value
  if (args.policy !== undefined) appJson.policy = args.policy
  if (args.deployment_message !== undefined) appJson.deployment_message = args.deployment_message
  const { multipart } = buildMultipart(
    appJson,
    args.js ?? `console.log('raw-app-update-${path}')`,
    args.css,
  )
  const res = await request.post(`${API_BASE}/w/${wid}/apps/update_raw/${path}`, {
    headers: { Cookie: auth.cookie },
    multipart,
  })
  if (!res.ok()) {
    throw new Error(`updateRawAppViaApi failed: ${res.status()} ${await res.text()}`)
  }
}

// Delete is shared with low-code apps — both `app_version.raw_app=true` and
// `raw_app=false` rows live in the same `app` table and share /apps/delete/<path>.
export const deleteRawAppViaApi = deleteAppViaApi
export const getRawAppViaApi = getAppViaApi

export const tryDeleteRawAppViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
): Promise<void> => {
  await deleteAppViaApi(request, auth, path).catch(() => {})
}
