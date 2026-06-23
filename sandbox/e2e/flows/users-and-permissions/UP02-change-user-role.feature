@flow @feature:users-and-permissions @worker
Feature: UP02 — Change a workspace user's role (admin)
  As a workspace admin,
  I click a different role chip on a member's row to change their workspace role,
  So that the row reflects the new role and the change is persisted.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a fresh test-owned workspace exists with an Operator-role member
    And I open Workspace Settings at "/workspace_settings?tab=users"

  Scenario: Admin promotes the Operator to Developer
    When I click the "Developer" role chip on the member's row
    Then the "Developer" role chip becomes the selected chip on that row
