@flow @feature:users-and-permissions @worker
Feature: UP06 — Delete a workspace group
  As a workspace admin,
  I delete a group from the Groups page,
  So that the group is removed from the list.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a fresh test-owned workspace exists with one group
    And I open the Groups page at "/groups"

  Scenario: Admin deletes the group and its row disappears
    When I open the row's dropdown for the group
    And I click "Delete"
    And I confirm the destructive action
    Then the group row is no longer visible on /groups
