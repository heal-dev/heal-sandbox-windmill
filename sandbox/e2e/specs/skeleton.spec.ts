import { test, expect } from '../data/fixtures'
import { FRONTEND_URL, SEED } from '../../config'

test('skeleton: signed-in admin sees the Admins workspace', async ({ page }) => {
  await page.goto(`${FRONTEND_URL}/user/workspaces`)
  await expect(
    page.getByRole('button', { name: /Admins\s*-\s*admins as superadmin/ }),
  ).toBeVisible()
})
