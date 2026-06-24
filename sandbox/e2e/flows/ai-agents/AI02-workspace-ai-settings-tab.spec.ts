import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'

// AI02 — The Workspace Settings page renders a "Windmill AI" tab
// (workspace_settings/+page.svelte L1066, sidebar entry id='ai' label='Windmill
// AI'). Navigating to /workspace_settings?tab=ai mounts the AISettings.svelte
// component which renders a SettingsPageHeader with title "Windmill AI" + the
// stock description, and an "AI Providers" SettingCard containing one Toggle
// per provider key in AI_PROVIDERS (copilot/lib.ts L61-110). The Anthropic
// toggle is also annotated with a "Recommended" Badge in the AISettings
// component (L421-429). All assertions are read-only — actually configuring a
// provider needs a real LLM API key resource which is out of scope here.

test.describe('@flow @feature:ai-agents @worker AI02 — Workspace AI settings tab', () => {
  test('AI tab renders the Windmill AI header and provider toggles', async ({
    page,
    request,
  }) => {
    await loginAdmin(request)
    await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
    await page.goto(`${FRONTEND_URL}/workspace_settings?tab=ai`)

    // SettingsPageHeader renders the title in a heading. Wait generously
    // because the page first fetches workspace settings via getSettings()
    // before deciding which tab body to mount.
    await expect(
      page.getByRole('heading', { name: /^Windmill AI$/ }).first(),
    ).toBeVisible({ timeout: 30_000 })

    // Description is hardcoded in AISettings.svelte L47.
    await expect(
      page
        .getByText('Windmill AI integrates with your favorite AI providers and models.', {
          exact: false,
        })
        .first(),
    ).toBeVisible({ timeout: 15_000 })

    // The "AI Providers" SettingCard wraps a list of Toggle components, one
    // per provider in AI_PROVIDERS. The Toggle renders its `options.right`
    // text as a label next to the switch — we look for the visible label text
    // for two stable providers (OpenAI and Anthropic; copilot/lib.ts L62, L70).
    // Use first() because the page can also surface these strings in
    // tooltips/badges and we only need to prove one rendered instance.
    await expect(page.getByText('Anthropic', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('OpenAI', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    })

    // The Anthropic row is decorated with a "Recommended" Badge (AISettings
    // L422-428) — its presence proves we're really on the AI tab body, not
    // just the sidebar nav item.
    await expect(page.getByText('Recommended', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})
