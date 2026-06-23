@scenario @feature:workspaces @invariant @worker
Feature: W01.S3 — Community Edition caps non-admin workspaces at 2
  As Windmill (Community Edition),
  I reject the creation of a 3rd user-owned workspace,
  So that the workspace cap is enforced.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And two test-owned workspaces already exist (the cap is reached)
    And I open the Create Workspace page at "/user/create_workspace"

  Scenario: Submitting a 3rd workspace shows the CE cap error
    When I fill the "Workspace name" field with "Acme Third"
    And I fill the "Workspace ID" field with a unique slug
    And I click the "Create workspace" button
    Then an error message is visible referencing the workspace cap (e.g. "maximum number of workspaces")
    And I remain on "/user/create_workspace"
