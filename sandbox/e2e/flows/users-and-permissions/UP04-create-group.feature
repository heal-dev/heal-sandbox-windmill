@flow @feature:users-and-permissions @worker
Feature: UP04 — Create a workspace group
  As a workspace admin,
  I create a group from the Groups page,
  So that I can later assign members and permissions to it.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And a fresh test-owned workspace exists and is selected
    And I open the Groups page at "/groups"

  Scenario: Admin creates a new group and the row appears
    Then I see the heading "Groups"

    When I click the "New group" button
    And I fill the popover's name input with a unique group name
    And I submit the popover
    Then a row referencing the new group's name is visible on /groups
