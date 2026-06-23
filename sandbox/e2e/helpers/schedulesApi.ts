import type { APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from '../../config'
import type { WsAuth } from './workspaceApi'

const wid = SEED.workspace.id

// Windmill defaults to 6-field cron (seconds-included). Test inputs commonly pass
// 5-field POSIX cron; normalize by prefixing `0 ` for the seconds slot.
const toWindmillCron = (cron: string): string => {
  const parts = cron.trim().split(/\s+/)
  return parts.length === 5 ? `0 ${cron}` : cron
}

export type CreateScheduleArgs = {
  path: string
  scriptPath: string
  schedule: string
  timezone?: string
  summary?: string
  enabled?: boolean
  isFlow?: boolean
}

export const createScheduleViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: CreateScheduleArgs,
): Promise<string> => {
  // Backend route: POST /api/w/<wid>/schedules/create
  // (windmill/backend/windmill-api-schedule/src/lib.rs line 92 + NewSchedule line 105)
  const body = {
    path: args.path,
    schedule: toWindmillCron(args.schedule),
    timezone: args.timezone ?? 'UTC',
    script_path: args.scriptPath,
    is_flow: args.isFlow ?? false,
    args: {},
    enabled: args.enabled ?? true,
    summary: args.summary ?? '',
    no_flow_overlap: false,
  }
  const res = await request.post(`${API_BASE}/w/${wid}/schedules/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: body,
  })
  if (!res.ok()) {
    throw new Error(`createScheduleViaApi failed: ${res.status()} ${await res.text()}`)
  }
  return (await res.text()).trim().replace(/^"|"$/g, '')
}

export const tryCreateScheduleViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  args: CreateScheduleArgs,
): Promise<{ ok: boolean; status: number; body: string }> => {
  const body = {
    path: args.path,
    schedule: toWindmillCron(args.schedule),
    timezone: args.timezone ?? 'UTC',
    script_path: args.scriptPath,
    is_flow: args.isFlow ?? false,
    args: {},
    enabled: args.enabled ?? true,
    summary: args.summary ?? '',
    no_flow_overlap: false,
  }
  const res = await request.post(`${API_BASE}/w/${wid}/schedules/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: body,
  })
  return { ok: res.ok(), status: res.status(), body: await res.text() }
}

export const deleteScheduleViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
): Promise<void> => {
  // Backend route: DELETE /api/w/<wid>/schedules/delete/<path>
  // (windmill/backend/windmill-api-schedule/src/lib.rs line 94 -> delete(delete_schedule))
  // Frontend ScheduleService.deleteSchedule (used at +page.svelte line 517) maps to the same.
  await request.delete(`${API_BASE}/w/${wid}/schedules/delete/${path}`, {
    headers: { Cookie: auth.cookie },
  })
}

// Defensive: clear any leftover schedule at this path before a test create.
export const tryDeleteScheduleViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
): Promise<void> => {
  await deleteScheduleViaApi(request, auth, path).catch(() => {})
}

export const setScheduleEnabledViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  path: string,
  enabled: boolean,
): Promise<void> => {
  // Backend route: POST /api/w/<wid>/schedules/setenabled/<path>
  // (windmill/backend/windmill-api-schedule/src/lib.rs around line 1007)
  const res = await request.post(`${API_BASE}/w/${wid}/schedules/setenabled/${path}`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: { enabled },
  })
  if (!res.ok()) {
    throw new Error(`setScheduleEnabledViaApi failed: ${res.status()} ${await res.text()}`)
  }
}
