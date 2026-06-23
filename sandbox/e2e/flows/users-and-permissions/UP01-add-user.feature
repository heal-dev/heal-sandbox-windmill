@flow @feature:users-and-permissions @worker
Feature: UP01 — Add a new user to a workspace (admin)
  As a workspace admin,
  I add a new user to the workspace from the Users tab,
  So that they can access the workspace at the role I assigned.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a fresh test-owned workspace exists and is selected
    And I open Workspace Settings at "/workspace_settings?tab=users"

  Scenario: Admin adds an Operator-role user and a row referencing the email appears
    When I click the "Add new user" button
    And I fill the user's email and pick the "Operator" role
    And I submit the dialog
    Then a row referencing the new user's email is visible on the Users tab
