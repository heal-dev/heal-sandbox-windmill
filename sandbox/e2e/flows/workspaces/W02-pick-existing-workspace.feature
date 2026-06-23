@flow @feature:workspaces @readonly
Feature: W02 — Pick an existing workspace from the picker
  As a developer with at least one workspace,
  I select an existing workspace from the picker,
  So that I land on Home with that workspace active.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the "admins" workspace exists from the seed
    And I open the "Workspace picker" at "/user/workspaces"

  Scenario: Selecting the seeded admins workspace lands on Home
    When I click the workspace tile whose accessible name matches "Admins - admins as superadmin"
    Then I land on the workspace home at "/"
    And the workspace selector in the sidebar shows "admins"
