@flow @feature:variables-and-resources @worker
Feature: VR02 — Secret variable's value is masked in the list
  As a developer,
  I create a secret variable,
  So that its value is masked in the /variables list response.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And I open the Variables page at "/variables"

  Scenario: Secret variable's value is not visible in the list
    When I click the "New variable" button
    And I fill the path with "u/admin/vr02-<rand>" and the value with "topsecret"
    And I toggle the "Secret" switch ON
    And I submit the form
    Then a row referencing path "u/admin/vr02-<rand>" is visible in the Variables table
    And the literal "topsecret" is NOT visible in that row
