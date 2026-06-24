@flow @feature:ai-agents @worker
Feature: AI02 — Workspace Settings → Windmill AI tab renders provider toggles
  As a workspace admin who wants to wire an AI provider for Windmill AI chat,
  I navigate to /workspace_settings?tab=ai,
  So that the AI settings page renders with provider toggles for OpenAI,
  Anthropic, Mistral, etc., proving the AI config surface is reachable on CE
  (configuring a real provider key is out of scope — it requires real LLM
  credentials).

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: AI tab renders the Windmill AI heading and provider toggles
    When I navigate to "/workspace_settings?tab=ai"
    Then the page heading "Windmill AI" is visible
    And the description "Windmill AI integrates with your favorite AI providers and models." is visible
    And a label or toggle referencing "Anthropic" is visible
    And a label or toggle referencing "OpenAI" is visible
