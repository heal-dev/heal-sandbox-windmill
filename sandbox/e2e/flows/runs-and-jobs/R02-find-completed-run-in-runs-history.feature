@flow @feature:runs-and-jobs @worker
Feature: R02 — Find a completed run in /runs history

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed Python script exists at "u/admin/r02-<rand>"
    And I have run that script once via API and waited for completion

  Scenario: The completed run appears on the /runs history page
    When I navigate to "/runs"
    Then the "Runs" heading is visible
    And a row referencing "u/admin/r02-<rand>" is visible in the runs list
