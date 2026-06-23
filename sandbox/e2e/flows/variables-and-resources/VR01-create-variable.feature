@flow @feature:variables-and-resources @worker
Feature: VR01 — Create a non-secret variable
  As a developer,
  I create a non-secret variable scoped to my user path,
  So that the variable is visible in /variables with its value shown.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And I open the Variables page at "/variables"

  Scenario: Create a plaintext variable and the value is visible in the list
    When I click the "New variable" button
    And I fill the path with "u/admin/vr01-<rand>" and the value with "hello"
    And I leave the "Secret" switch OFF
    And I submit the form
    Then a row referencing path "u/admin/vr01-<rand>" is visible in the Variables table
    And the value "hello" is visible in that row
