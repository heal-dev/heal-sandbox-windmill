@flow @feature:folders @worker
Feature: FD02 — Add a group member to a folder

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And folder "fd02-<rand>" exists
    And I am on "/folders"

  Scenario: Open editor → switch to Group → pick "all" → Grant → row visible
    When I click the row for "fd02-<rand>"
    And in the FolderEditor I switch the User|Group toggle to "Group"
    And I pick group "all" in the Select
    And I click "Grant"
    Then GET /api/w/admins/folders/get/fd02-<rand> returns owners containing "g/all"
    And the Permissions table in the drawer contains a row labelled "g/all"
