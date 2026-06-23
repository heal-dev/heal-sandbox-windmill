import { test as setup, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { API_BASE, AUTH_STATE_PATH, FRONTEND_URL, SEED } from '../../config'

setup('sign in as default admin and persist storageState', async ({ request, page }) => {
  const login = await request.post(`${API_BASE}/auth/login`, {
    data: { email: SEED.admin.email, password: SEED.admin.password },
  })
  expect(login.ok(), `login failed: ${login.status()} ${await login.text()}`).toBeTruthy()
  const token = (await login.text()).trim().replace(/^"|"$/g, '')

  await page.goto(FRONTEND_URL)
  await page.context().addCookies([
    {
      name: 'token',
      value: token,
      url: FRONTEND_URL,
      httpOnly: false,
      sameSite: 'Lax',
    },
  ])

  await page.goto(`${FRONTEND_URL}/user/workspaces`)
  await expect(
    page.getByRole('button', { name: /Admins\s*-\s*admins as superadmin/ }),
  ).toBeVisible({ timeout: 30_000 })

  mkdirSync(dirname(AUTH_STATE_PATH), { recursive: true })
  await page.context().storageState({ path: AUTH_STATE_PATH })
})
