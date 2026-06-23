@flow @feature:users-and-permissions @worker
Feature: UP03 — Self-demotion prevention (admin cannot demote themselves)
  As an admin viewing my own row on the Users tab,
  I cannot click an Operator or Developer chip on my own row,
  So that I cannot accidentally lock myself out of the workspace.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a fresh test-owned workspace exists and is selected (I am the admin)
    And I open Workspace Settings at "/workspace_settings?tab=users"

  Scenario: My own Operator and Developer chips do not become selected
    When I attempt to click the "Operator" chip on my own row
    Then my row's selected chip is still "Admin"
