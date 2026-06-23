@flow @feature:variables-and-resources @worker
Feature: VR06 — Create a workspace-scoped resource type (admin)
  As a workspace admin,
  I create a new resource type with a JSON Schema on the Resource Types tab,
  So that the type appears in the list and can be used when creating resources.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And I open the Resources page at "/resources"

  Scenario: Admin creates a resource type and it appears in the Resource Types table
    When I switch to the "Resource Types" tab
    And I click the "Add resource type" button
    And I fill the name and provide a JSON Schema (object with a required "host" string)
    And I submit the form
    Then a row referencing the new resource type name is visible in the Resource Types table
