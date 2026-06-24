@flow @feature:flows @worker
Feature: F04 — Delete a flow from its detail page menu

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a Python flow exists at "u/admin/f04-<rand>"

  Scenario: Deleting a flow removes it from the workspace
    When I navigate to "/flows/get/u/admin/f04-<rand>"
    And I open the actions menu and click "Delete"
    Then the flow no longer exists at "u/admin/f04-<rand>"
