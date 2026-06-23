@flow @feature:schedules @worker
Feature: SC05 — Edit a schedule's cron from /schedules
  As a developer who owns a schedule,
  I open it from /schedules, change the cron expression in the editor, and save,
  So the schedules list reflects the new cron.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a schedule "u/admin/sc05-<rand>" exists with cron "* * * * *"
    And I am on "/schedules"

  Scenario: Edit a schedule's cron via the row's Edit affordance
    When I open the row's Edit affordance for the schedule
    And I change the "Cron" textbox to "*/5 * * * *"
    And I click "Save"
    Then the row's cron column now shows "*/5 * * * *"
