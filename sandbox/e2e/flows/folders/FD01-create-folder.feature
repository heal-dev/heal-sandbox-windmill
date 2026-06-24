@flow @feature:folders @worker
Feature: FD01 — Create a folder from /folders

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And I am on "/folders"

  Scenario: New folder → Create → drawer opens → row visible
    When I click "New folder"
    And I fill the "New folder name" input with "fd01-<rand>"
    And I click "Create"
    Then the FolderEditor drawer opens with title "Folder fd01-<rand>"
    And a row whose Name cell contains "fd01-<rand>" is visible in the folders table
