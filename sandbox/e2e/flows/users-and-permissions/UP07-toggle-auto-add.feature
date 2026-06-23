@flow @feature:users-and-permissions @worker
Feature: UP07 — Toggle the workspace's auto-add (or auto-invite) setting
  As a workspace admin,
  I open the auto-add popover from the Users tab and enable it,
  So that new users with a matching email domain are auto-added (or auto-invited).

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a fresh test-owned workspace exists with auto-add OFF
    And I open Workspace Settings at "/workspace_settings?tab=users"

  Scenario: Enabling auto-add flips the toggle button to ON
    When I open the "Auto-add: OFF" (or "Auto-invite: OFF") popover
    And I enable the master toggle and pick "Operator" as the default role
    And I close the popover
    Then the toggle button now reads "Auto-add: ON" (or "Auto-invite: ON")
