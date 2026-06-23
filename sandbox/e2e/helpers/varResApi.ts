import type { APIRequestContext } from '@playwright/test'
import { API_BASE, SEED } from '../../config'
import type { WsAuth } from './workspaceApi'

const ws = SEED.workspace.id

export const deleteVariable = async (req: APIRequestContext, auth: WsAuth, path: string) => {
  await req.delete(`${API_BASE}/w/${ws}/variables/delete/${encodeURIComponent(path)}`, {
    headers: { Cookie: auth.cookie },
  })
}

export const createVariable = async (
  req: APIRequestContext,
  auth: WsAuth,
  path: string,
  value: string,
  isSecret: boolean = false,
) => {
  const res = await req.post(`${API_BASE}/w/${ws}/variables/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: { path, value, is_secret: isSecret, description: '' },
  })
  if (!res.ok()) throw new Error(`createVariable failed: ${res.status()} ${await res.text()}`)
}

export const deleteResource = async (req: APIRequestContext, auth: WsAuth, path: string) => {
  await req.delete(`${API_BASE}/w/${ws}/resources/delete/${encodeURIComponent(path)}`, {
    headers: { Cookie: auth.cookie },
  })
}

export const createResource = async (
  req: APIRequestContext,
  auth: WsAuth,
  path: string,
  resourceType: string,
  value: Record<string, unknown>,
) => {
  const res = await req.post(`${API_BASE}/w/${ws}/resources/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: { path, value, resource_type: resourceType, description: '' },
  })
  if (!res.ok()) throw new Error(`createResource failed: ${res.status()} ${await res.text()}`)
}

export const deleteResourceType = async (req: APIRequestContext, auth: WsAuth, name: string) => {
  await req.delete(`${API_BASE}/w/${ws}/resources/type/delete/${name}`, {
    headers: { Cookie: auth.cookie },
  })
}

export const ensureSimpleResourceType = async (req: APIRequestContext, auth: WsAuth, name: string) => {
  const res = await req.post(`${API_BASE}/w/${ws}/resources/type/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: {
      name,
      schema: { type: 'object', properties: { host: { type: 'string' } }, required: ['host'] },
      description: 'test',
    },
  })
  if (!res.ok()) {
    const t = await res.text()
    if (!/already/i.test(t)) throw new Error(`ensureResourceType failed: ${res.status()} ${t}`)
  }
}
