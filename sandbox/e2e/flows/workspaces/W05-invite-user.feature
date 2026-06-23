@flow @feature:workspaces @worker
Feature: W05 — Invite a user to a workspace (admin)
  As a workspace admin,
  I invite a user by email from Workspace Settings → Users,
  So that the invited user can accept and join the workspace.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a fresh test-owned workspace exists and is selected
    And I open Workspace Settings at "/workspace_settings?tab=users"

  Scenario: Admin sends an invite and a pending member row appears
    Then I see the heading "Members (1)" or similar above the members list

    When I click the "Invite user" button
    And I fill the "Email" field with a unique invitee address
    And I select the "operator" role
    And I click the "Invite" confirm button
    Then a pending-invite row referencing the invitee email is visible in the page
