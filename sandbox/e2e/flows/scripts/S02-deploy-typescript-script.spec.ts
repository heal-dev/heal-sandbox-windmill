import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { deleteScriptViaApi } from '../../helpers/scriptsApi'

test.describe('@flow @feature:scripts @worker S02 — Deploy TypeScript (Bun) script from Home', () => {
  test('Switch to TypeScript (Bun) and deploy a hello script', async ({ page, request, fx }) => {
    const auth = await loginAdmin(request)
    let scriptPath = ''

    try {
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/`)
      await expect(page.getByRole('heading', { name: /^Home$/i })).toBeVisible({ timeout: 30_000 })

      await page
        .getByRole('link', { name: /^Script$/ })
        .or(page.getByRole('button', { name: /^Script$/ }))
        .first()
        .click()
      await page.waitForURL(/\/scripts\/(?:add|edit\/u\/)/, { timeout: 60_000 })

      const slug = `s02-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30)

      // Pick the TypeScript (Bun) tile from the Language picker.
      const bunTile = page.getByRole('button', { name: /^TypeScript\s*\(Bun\)$/ }).first()
      if (await bunTile.isVisible().catch(() => false)) {
        await bunTile.click()
      } else {
        await page.getByText(/^TypeScript\s*\(Bun\)$/).first().click()
      }
      await expect(page.getByRole('button', { name: /^Deploy$/ })).toBeEnabled({ timeout: 30_000 })
      await page.waitForTimeout(1_000)

      const body = "export async function main() {\n  return 'hello windmill'\n}\n"
      const setViaApi = await page.evaluate(async (newBody) => {
        const mon = (window as any).monaco
        const editors = mon?.editor?.getEditors?.() ?? []
        const target = editors.find((e: any) => {
          try {
            const uri = e.getModel?.()?.uri?.toString?.() ?? ''
            return /\.(ts|js|tsx)$/.test(uri)
          } catch { return false }
        }) ?? editors[0]
        if (!target) return false
        target.focus()
        target.setValue(newBody)
        return true
      }, body)
      if (!setViaApi) {
        const editorInput = page.getByRole('textbox', { name: 'Editor content' }).first()
        await editorInput.focus()
        await page.keyboard.press('Control+A')
        await page.keyboard.press('Delete')
        await page.keyboard.type(body)
      }

      const summaryInput = page
        .getByPlaceholder(/summary/i)
        .first()
        .or(page.getByLabel(/summary/i).first())
      if (await summaryInput.count()) {
        await summaryInput.fill(`s02 ${slug}`).catch(() => {})
      }

      await expect(
        page.locator('[aria-label="Autosave status"]').getByText(/^Saved$/),
      ).toBeVisible({ timeout: 30_000 })

      await page.getByRole('button', { name: /^Deploy$/ }).dispatchEvent('click')
      await page.waitForURL(/\/scripts\/get\//, { timeout: 60_000 })

      const url = new URL(page.url())
      scriptPath = decodeURIComponent(url.pathname.replace(/^\/scripts\/get\//, ''))
      await expect(
        page.getByRole('button', { name: /^Run(?:\b|$|\s)/ }).first(),
      ).toBeVisible({ timeout: 30_000 })
    } finally {
      if (scriptPath && !/^[a-f0-9]{8,}$/i.test(scriptPath)) {
        await deleteScriptViaApi(request, auth, scriptPath).catch(() => {})
      }
    }
  })
})
