@flow @feature:workspaces @worker
Feature: W04 — Edit workspace name from Workspace Settings (admin)
  As a workspace admin,
  I rename the workspace from the General tab of Workspace Settings,
  So that the new name appears in the workspace selector and across the UI.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a fresh test-owned workspace exists and is selected (workspace cap honored)
    And I open Workspace Settings at "/workspace_settings?tab=general"

  Scenario: Admin renames the workspace and the new name is visible
    Then I see the heading "Workspace settings: <my workspace>"
    And I see the section heading "General"

    When I clear the "Workspace name" field
    And I fill the "Workspace name" field with "Acme Renamed"
    And I click "Save"
    Then a "Saved" confirmation is visible
    And reopening Workspace Settings still shows the "Workspace name" as "Acme Renamed"
