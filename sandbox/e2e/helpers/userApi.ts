import type { APIRequestContext } from '@playwright/test'
import { API_BASE } from '../../config'
import type { WsAuth } from './workspaceApi'

export const addUserToWorkspace = async (
  request: APIRequestContext,
  auth: WsAuth,
  workspaceId: string,
  email: string,
  role: 'operator' | 'developer' | 'admin' = 'developer',
): Promise<void> => {
  const res = await request.post(`${API_BASE}/w/${workspaceId}/users/add`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: {
      email,
      username: email.split('@')[0].replace(/[^a-z0-9_]/g, '_').slice(0, 30),
      operator: role === 'operator',
      is_admin: role === 'admin',
    },
  })
  if (!res.ok()) {
    throw new Error(`addUserToWorkspace failed: ${res.status()} ${await res.text()}`)
  }
}

export const createGroup = async (
  request: APIRequestContext,
  auth: WsAuth,
  workspaceId: string,
  name: string,
): Promise<void> => {
  const res = await request.post(`${API_BASE}/w/${workspaceId}/groups/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: { name, summary: null },
  })
  if (!res.ok()) {
    throw new Error(`createGroup failed: ${res.status()} ${await res.text()}`)
  }
}

export const createInstanceUser = async (
  request: APIRequestContext,
  auth: WsAuth,
  email: string,
  password: string = 'changeme123',
): Promise<void> => {
  const res = await request.post(`${API_BASE}/users/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: { email, password, name: email.split('@')[0], super_admin: false },
  })
  if (!res.ok()) {
    const t = await res.text()
    if (!/already.*exist|conflict/i.test(t)) {
      throw new Error(`createInstanceUser failed: ${res.status()} ${t}`)
    }
  }
}
