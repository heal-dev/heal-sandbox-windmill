@flow @feature:schedules @worker
Feature: SC06 — Delete a schedule from /schedules
  As a developer who owns a schedule,
  I delete it from /schedules via the row's dropdown → Delete,
  So the row disappears and the cron stops firing.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a schedule "u/admin/sc06-<rand>" exists for a deployed script
    And I am on "/schedules"

  Scenario: Deleting a schedule removes its row
    When I open the row's dropdown / kebab menu
    And I click "Delete"
    Then no row with that path is visible on "/schedules"
