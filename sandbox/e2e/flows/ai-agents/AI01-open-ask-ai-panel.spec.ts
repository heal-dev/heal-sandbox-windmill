import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'

// AI01 — The "Ask AI" sidebar item (and Cmd/Ctrl+L shortcut) toggles the AI
// chat panel. The panel mounts a region with aria-label="AI chat"
// (AIChatDisplay.svelte L489) regardless of whether copilot credentials are
// configured — when no provider is wired the panel shows a disabled hint
// instead, but the region still renders. We assert only the region presence
// and the never-disabled chrome (the "Chat" header + the keyboard-hint
// footnote that always appears when no messages are present) so the test does
// not require any LLM credentials.

test.describe('@flow @feature:ai-agents @worker AI01 — Open Ask AI panel', () => {
  test('Clicking sidebar "Ask AI" mounts a region with aria-label "AI chat"', async ({
    page,
    request,
  }) => {
    await loginAdmin(request)
    await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
    await page.goto(`${FRONTEND_URL}/`)

    // Wait for the (logged) layout to render so the sidebar is mounted. The
    // sidebar MenuButton renders the label "Ask AI" with the wand icon
    // (+layout.svelte L693). It may appear in the collapsed (icon-only) or
    // expanded variant; in both cases its accessible name includes "Ask AI".
    const askAiButton = page
      .getByRole('button', { name: /Ask AI/i })
      .or(page.getByRole('link', { name: /Ask AI/i }))
      .first()
    await expect(askAiButton).toBeVisible({ timeout: 30_000 })

    // Pre-state: the chat region should NOT be mounted yet (it is gated on
    // aiChatManager.open === true; chatState.size > 0 in AIChatManager L347).
    await expect(page.getByRole('region', { name: 'AI chat' })).toHaveCount(0)

    await askAiButton.click()

    // The AIChatDisplay outer div has role="region" aria-label="AI chat"
    // (AIChatDisplay.svelte L488-489). Web-first matcher waits for it to mount.
    await expect(page.getByRole('region', { name: 'AI chat' })).toBeVisible({
      timeout: 15_000,
    })

    // The header always renders the literal text "Chat" inside a p.text-sm
    // (AIChatDisplay.svelte L508). hideHeader defaults to false.
    await expect(
      page.getByRole('region', { name: 'AI chat' }).getByText('Chat', { exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 })

    // The empty-state keyboard hint always renders when messages.length === 0
    // and no custom emptyHint snippet is supplied (AIChatDisplay.svelte
    // L582-585). It reads e.g. "You can use ⌘L to open or close this chat,
    // and ⌘K in the script editor to modify selected lines." — we match the
    // stable substring.
    await expect(
      page.getByText(/to open or close this chat/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('Clicking "Ask AI" again toggles the chat region closed', async ({
    page,
    request,
  }) => {
    // The Cmd/Ctrl+L keyboard shortcut (AIChat.svelte L110-118) is not
    // exercised here because the headless Chromium target reserves Control+L
    // for the location bar, so the svelte:window onkeydown listener never
    // fires under Playwright. The user-visible sidebar 'Ask AI' MenuButton
    // routes through the exact same aiChatManager.toggleOpen() call (see
    // +layout.svelte L693 onClick), so this test proves the OPEN → CLOSE
    // invariant against that observable affordance instead. See AI01.S2 in
    // the spec, which documents the keyboard chord; this test covers the
    // toggle invariant only.
    await loginAdmin(request)
    await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
    await page.goto(`${FRONTEND_URL}/`)

    const askAiButton = page
      .getByRole('button', { name: /Ask AI/i })
      .or(page.getByRole('link', { name: /Ask AI/i }))
      .first()
    await expect(askAiButton).toBeVisible({ timeout: 30_000 })

    await askAiButton.click()
    await expect(page.getByRole('region', { name: 'AI chat' })).toBeVisible({
      timeout: 15_000,
    })

    await askAiButton.click()
    // When chatState.size drops to 0, the AIChat component unmounts the
    // AIChatDisplay region (AIChatManager.svelte.ts L347).
    await expect(page.getByRole('region', { name: 'AI chat' })).toHaveCount(0, {
      timeout: 10_000,
    })
  })
})
