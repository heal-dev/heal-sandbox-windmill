@flow @feature:schedules @worker
Feature: SC02 — A created schedule is listed on /schedules
  As a developer who just created a schedule,
  I navigate to /schedules from the sidebar
  And I see a row referencing that schedule's path.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed script exists at "u/admin/sc02-<rand>"
    And a schedule "u/admin/sc02-<rand>" exists with cron "* * * * *" for that script

  Scenario: The newly created schedule appears in /schedules
    When I navigate to "/schedules"
    Then the "Schedules" heading is visible
    And a row referencing "u/admin/sc02-<rand>" with cron "* * * * *" is visible
