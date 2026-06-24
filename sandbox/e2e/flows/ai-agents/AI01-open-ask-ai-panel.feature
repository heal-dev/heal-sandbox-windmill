@flow @feature:ai-agents @worker
Feature: AI01 — Open the Ask AI chat panel from the sidebar
  As a developer working in the Windmill UI,
  I open the Ask AI chat panel from the sidebar (or with the Cmd/Ctrl+L shortcut),
  So that the AI chat region mounts and is ready to receive a prompt.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And I navigate to the workspace home at "/"

  Scenario: Clicking the "Ask AI" sidebar item mounts the AI chat region
    When I click the sidebar item labeled "Ask AI"
    Then a region with accessible name "AI chat" is visible
    And the chat header containing the text "Chat" is visible
    And the keyboard-hint text "to open or close this chat" is visible

  Scenario: Clicking "Ask AI" a second time toggles the chat region closed
    # The Cmd/Ctrl+L keyboard chord is the documented shortcut (see AI01.S2
    # in spec.json), but the headless Chromium target reserves Control+L for
    # the location bar, so the svelte:window keydown listener never fires
    # under Playwright. We assert the OPEN → CLOSE invariant against the
    # sidebar MenuButton (which routes through the same toggleOpen() call).
    When I click the sidebar item labeled "Ask AI"
    Then a region with accessible name "AI chat" is visible
    When I click the sidebar item labeled "Ask AI" again
    Then no region with accessible name "AI chat" is mounted
