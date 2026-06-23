@flow @feature:workspaces @worker
Feature: W07 — Archive a workspace (admin)
  As a workspace admin,
  I archive a workspace from the Advanced tab of Workspace Settings,
  So that the workspace is hidden from non-superadmin pickers until unarchived.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a fresh test-owned workspace exists and is selected
    And I open Workspace Settings at "/workspace_settings?tab=general"

  Scenario: Archiving the workspace returns me to the picker
    When I click the "Archive workspace" button
    And I confirm the destructive action
    Then I land on "/user/workspaces" with the "Select a workspace" heading visible
