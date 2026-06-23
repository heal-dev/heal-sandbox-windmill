@flow @feature:schedules @worker
Feature: SC01 — Create a schedule from a deployed script's Triggers panel
  As a developer on a freshly deployed script,
  I open the Triggers tab, add a Schedule trigger, fill the cron,
  and save — so the schedule is attached to the script.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed script exists at "u/admin/sc01-<rand>"
    And I am on "/scripts/get/u/admin/sc01-<rand>"

  Scenario: Add a Schedule trigger from the script's Triggers tab
    When I switch to the "Triggers" tab in the script-detail panel
    And I click "Add trigger" and pick "Schedule" from the chooser
    And I fill the "Cron" textbox with "* * * * *"
    And I save the schedule (via the Save / Deploy affordance)
    Then a schedule referencing the script appears in "/schedules"
