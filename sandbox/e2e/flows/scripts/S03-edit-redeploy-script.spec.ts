import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createScriptViaApi, deleteScriptViaApi } from '../../helpers/scriptsApi'

test.describe('@flow @feature:scripts @worker S03 — Edit and re-deploy an existing script', () => {
  test('Re-deploying updates the script body and lands on the detail page', async ({
    page,
    request,
    fx,
  }) => {
    const auth = await loginAdmin(request)
    const slug = `scripts-s03-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
    const path = `u/admin/${slug}`
    const v1 = "def main():\n    return 'v1'\n"
    const v2 = "def main():\n    return 'v2'\n"

    await createScriptViaApi(request, auth, {
      path,
      language: 'python3',
      content: v1,
      summary: 'S03 v1',
    })

    try {
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/scripts/get/${path}`)
      await page.waitForURL(/\/scripts\/get\//, { timeout: 60_000 })

      // Click Edit to enter the editor for the deployed script.
      const editLink = page
        .getByRole('link', { name: /^Edit$/ })
        .or(page.getByRole('button', { name: /^Edit$/ }))
        .first()
      await expect(editLink).toBeVisible({ timeout: 30_000 })
      await editLink.click()
      await page.waitForURL(new RegExp(`/scripts/edit/${path}`), { timeout: 60_000 })
      await expect(page.getByRole('button', { name: /^Deploy$/ }).first()).toBeEnabled({ timeout: 30_000 })

      // The editor needs a moment to hydrate the deployed v1 body before our
      // setValue takes effect — wait for the on-screen Monaco textbox to be
      // visible, plus a small settle (Monaco loads after the textbox attaches).
      await expect(
        page.getByRole('textbox', { name: 'Editor content' }).first(),
      ).toBeAttached({ timeout: 30_000 })
      await page.waitForTimeout(2_000)

      const setViaApi = await page.evaluate(async (newBody) => {
        const mon = (window as any).monaco
        const editors = mon?.editor?.getEditors?.() ?? []
        const target = editors.find((e: any) => {
          try {
            const uri = e.getModel?.()?.uri?.toString?.() ?? ''
            return uri.endsWith('.py')
          } catch { return false }
        }) ?? editors[0]
        if (!target) return false
        target.focus()
        target.setValue(newBody)
        return true
      }, v2)
      if (!setViaApi) {
        const editorInput = page.getByRole('textbox', { name: 'Editor content' }).first()
        await editorInput.focus()
        await page.keyboard.press('Control+A')
        await page.keyboard.press('Delete')
        await page.keyboard.type(v2)
      }

      await expect(
        page.locator('[aria-label="Autosave status"]').getByText(/^Saved$/),
      ).toBeVisible({ timeout: 30_000 })

      await page.getByRole('button', { name: /^Deploy$/ }).first().dispatchEvent('click')
      // After re-deploy, Windmill navigates to /scripts/get/<new-hash> rather
      // than the path form — both URLs refer to the same script.
      await page.waitForURL(/\/scripts\/get\//, { timeout: 60_000 })

      // The detail page right-pane defaults to "Inputs library". The deployed
      // source is rendered inside the "Script" pane (HighlightCode under the
      // inner Code tab, which is selected by default). The pane switcher is
      // exposed with role=button, not role=tab, so click the Script button.
      await page.getByRole('button', { name: /^Script$/, exact: true }).first().click()
      await expect(page.getByText(/return 'v2'/).first()).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(/return 'v1'/)).toHaveCount(0)
    } finally {
      await deleteScriptViaApi(request, auth, path).catch(() => {})
    }
  })
})
