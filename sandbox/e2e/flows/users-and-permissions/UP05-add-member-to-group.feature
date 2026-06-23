@flow @feature:users-and-permissions @worker
Feature: UP05 — Add a member to a workspace group (admin)
  As a workspace admin,
  I open an existing group and add a workspace user as a member,
  So that the user inherits the group's permissions.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a fresh test-owned workspace exists with one group and one Operator-role member
    And I open the Groups page at "/groups"

  Scenario: Admin adds the workspace user to the group
    When I open the existing group from the list
    And I add the workspace user to the group's members
    Then the user's email is visible in the group's member list
