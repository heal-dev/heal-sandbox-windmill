@flow @feature:ai-agents @worker
Feature: AI03 — Persist a flow that contains an AI Agent step
  As a developer building an AI workflow,
  I create a flow whose value contains an AI Agent module (type=aiagent),
  So that the flow row is persisted with its agent step and the deployed flow
  detail page renders the "AI Agent" label in the FlowGraphViewer.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: A single-step flow whose only module is type=aiagent is persisted and rendered
    When I POST a flow at "u/admin/ai03-<rand>" with one module of type "aiagent" and empty tools
    Then the API returns 201
    And GET /api/w/admins/flows/get/u/admin/ai03-<rand> returns a flow whose first module value.type is "aiagent"
    And navigating to /flows/get/u/admin/ai03-<rand> mounts the flow detail page (h1 containing the flow path)
    And the FlowGraphViewer renders the text "AI Agent"
