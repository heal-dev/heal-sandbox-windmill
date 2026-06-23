@flow @feature:workspaces @worker
Feature: W01 — Create a new workspace from the picker and land on Home
  As a new developer with no workspace yet,
  I create a workspace from the picker,
  So that I can use the (logged) feature routes.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And I open the "Workspace picker" at "/user/workspaces"

  Scenario: Create a workspace with a valid name and slug ID
    When I click the "+ Create a new workspace" link
    Then I am on "/user/create_workspace" with the heading "New Workspace"

    When I fill the "Workspace name" field with "Acme"
    And I fill the "Workspace ID" field with a unique slug
    And I click the "Create workspace" button
    Then I land on the workspace home at "/"
    And the workspace selector in the sidebar shows my new workspace ID
