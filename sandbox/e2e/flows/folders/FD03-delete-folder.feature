@flow @feature:folders @worker
Feature: FD03 — Delete a folder

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And folder "fd03-<rand>" exists
    And I am on "/folders"

  Scenario: Row kebab → Delete → row gone + GET 404
    When I open the row's kebab menu for "fd03-<rand>"
    And I click "Delete"
    Then GET /api/w/admins/folders/get/fd03-<rand> returns HTTP 404
    And no row whose Name cell contains "fd03-<rand>" is visible in the folders table
