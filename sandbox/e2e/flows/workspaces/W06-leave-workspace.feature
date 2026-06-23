@flow @feature:workspaces @worker
Feature: W06 — Leave a workspace
  As a member of a workspace I no longer need,
  I leave it from Workspace Settings,
  So that I return to the workspace picker without that workspace listed.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a fresh test-owned workspace exists and is selected
    And I open Workspace Settings at "/workspace_settings"

  Scenario: Leaving the workspace returns me to the picker and removes it
    When I click the "Leave workspace" button
    And I confirm the destructive action
    Then I land on "/user/workspaces" with the "Select a workspace" heading visible
    And the workspace I just left is no longer in the "Workspaces" section
