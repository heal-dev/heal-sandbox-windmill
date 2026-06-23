@flow @feature:variables-and-resources @worker
Feature: VR04 — Create a resource of an existing resource type
  As a developer,
  I create a resource of an existing type and fill its required fields,
  So that the resource appears in the /resources list.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a resource type "vr04-rt-<rand>" exists with a JSON Schema requiring a "host" string
    And I open the Resources page at "/resources"

  Scenario: Developer creates a typed resource and the row appears
    When I click the "Add resource" button
    And I pick the existing resource type from the chooser
    And I fill the path with "u/admin/vr04-<rand>" and the required "host" field with "db.example.com"
    And I submit the form
    Then a row referencing path "u/admin/vr04-<rand>" is visible in the Resources table
