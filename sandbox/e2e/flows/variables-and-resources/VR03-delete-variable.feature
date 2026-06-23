@flow @feature:variables-and-resources @worker
Feature: VR03 — Delete a variable
  As the owner of a variable,
  I delete it from the Variables list,
  So that the row no longer appears.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a variable at path "u/admin/vr03-<rand>" exists in the seeded "admins" workspace
    And I open the Variables page at "/variables"

  Scenario: Owner deletes the variable and the row disappears
    When I open the action menu for the variable row
    And I click "Delete"
    And I confirm the destructive action
    Then no row referencing path "u/admin/vr03-<rand>" is visible
