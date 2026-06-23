@scenario @feature:variables-and-resources @invariant @readonly
Feature: VR01.S2 — Variable path must match the u/.../... / f/.../... / g/.../... format
  As Windmill,
  I reject any variable path that doesn't start with u/, f/, or g/ and follow the slug rules,
  So that variable paths stay parseable.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And I open the Variables page at "/variables" and click "New variable"

  Scenario: Invalid path 'tmp/whatever' blocks submission
    When I fill the path with "tmp/whatever"
    Then a path validation message is visible and the submit button is disabled
