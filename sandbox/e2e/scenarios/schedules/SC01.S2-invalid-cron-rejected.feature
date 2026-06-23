@scenario @feature:schedules @worker
Feature: SC01.S2 — Creating a schedule with an invalid cron is rejected
  As Windmill,
  I reject a schedule whose Cron field is not a valid cron expression,
  So invalid schedules never get persisted.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed script exists at "u/admin/sc01s2-<rand>"
    And the schedule editor is open on /schedules

  Scenario: Saving an invalid cron does not create a schedule row
    When I fill the "Cron" textbox with "not a cron"
    And I attempt to click "Save"
    Then the schedule is not persisted
    And no row for that path appears on /schedules
