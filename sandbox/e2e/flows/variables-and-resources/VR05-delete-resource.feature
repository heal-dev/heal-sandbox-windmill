@flow @feature:variables-and-resources @worker
Feature: VR05 — Delete a resource
  As the owner of a resource,
  I delete it from the Resources list,
  So that the row disappears.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a resource at path "u/admin/vr05-<rand>" of type "vr05-rt-<rand>" exists
    And I open the Resources page at "/resources"

  Scenario: Owner deletes the resource and the row disappears
    When I open the action menu for the resource row
    And I click "Delete"
    And I confirm the destructive action
    Then no row referencing path "u/admin/vr05-<rand>" is visible
