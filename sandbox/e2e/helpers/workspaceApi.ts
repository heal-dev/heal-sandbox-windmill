import type { APIRequestContext, Page } from '@playwright/test'
import { API_BASE, SEED } from '../../config'

export type WsAuth = { cookie: string }

export const loginAdmin = async (request: APIRequestContext): Promise<WsAuth> => {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: SEED.admin.email, password: SEED.admin.password },
  })
  if (!res.ok()) throw new Error(`admin login failed: ${res.status()}`)
  const token = (await res.text()).trim().replace(/^"|"$/g, '')
  return { cookie: `token=${token}` }
}

export const listAdminWorkspaces = async (
  request: APIRequestContext,
  auth: WsAuth,
): Promise<Array<{ id: string; name: string }>> => {
  const res = await request.get(`${API_BASE}/workspaces/list`, {
    headers: { Cookie: auth.cookie },
  })
  if (!res.ok()) return []
  return (await res.json()) as Array<{ id: string; name: string }>
}

export const deleteAcmeWorkspaces = async (
  request: APIRequestContext,
  auth: WsAuth,
): Promise<void> => {
  const ws = await listAdminWorkspaces(request, auth)
  for (const w of ws) {
    if (w.id === SEED.workspace.id) continue
    if (!/^acme/i.test(w.id) && !/^acme$/i.test(w.name)) continue
    await request.delete(`${API_BASE}/workspaces/delete/${w.id}`, {
      headers: { Cookie: auth.cookie },
    })
  }
}

export const createWorkspaceViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  id: string,
  name: string,
): Promise<void> => {
  const res = await request.post(`${API_BASE}/workspaces/create`, {
    headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
    data: { id, name },
  })
  if (!res.ok()) {
    throw new Error(`createWorkspaceViaApi failed: ${res.status()} ${await res.text()}`)
  }
}

export const deleteWorkspaceViaApi = async (
  request: APIRequestContext,
  auth: WsAuth,
  id: string,
): Promise<void> => {
  await request.delete(`${API_BASE}/workspaces/delete/${id}`, {
    headers: { Cookie: auth.cookie },
  })
}

export const nsToWorkspaceId = (ns: string): string =>
  `acme-${ns}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40)

// Make the (logged) layout pick `id` as the active workspace on the next
// navigation. addInitScript runs *before* the page module loads, so the
// workspaceStore reads the value during its own initialization. Must be
// called BEFORE page.goto into a (logged) route.
export const selectWorkspaceForPage = async (page: Page, id: string): Promise<void> => {
  await page.addInitScript((value) => {
    try { localStorage.setItem('workspace', value) } catch {}
  }, id)
}
