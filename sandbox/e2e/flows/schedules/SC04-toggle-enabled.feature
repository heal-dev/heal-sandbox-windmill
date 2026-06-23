@flow @feature:schedules @worker
Feature: SC04 — Toggle a schedule's enabled state from /schedules
  As a developer who owns a schedule,
  I flip its enabled toggle on the /schedules row;
  The cron immediately stops (or resumes) firing.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And an enabled schedule "u/admin/sc04-<rand>" exists for a deployed script
    And I am on "/schedules"

  Scenario: Disabling and re-enabling a schedule via the row toggle
    When I click the enabled toggle on the schedule's row
    Then the schedule becomes disabled
    When I click the enabled toggle again
    Then the schedule becomes enabled again
