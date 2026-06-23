@flow @feature:schedules @worker
Feature: SC03 — Create a schedule from the standalone /schedules page
  As a developer who already has a deployed script,
  I open /schedules, click "New schedule", pick the script in the editor,
  fill the cron, and save — so a new schedule row appears in the list.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed script exists at "u/admin/sc03-<rand>"
    And I am on "/schedules"

  Scenario: Create a schedule via /schedules → New schedule
    When I click "New schedule"
    And I pick the deployed script in the "Pick a script" input
    And I fill the "Cron" textbox with "0 9 * * *"
    And I set the schedule path-name to "sc03-<rand>"
    And I click "Save"
    Then the schedule editor closes
    And a row referencing the schedule appears in the schedules list
