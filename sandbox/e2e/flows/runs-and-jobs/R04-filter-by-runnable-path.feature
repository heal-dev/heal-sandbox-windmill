@flow @feature:runs-and-jobs @worker
Feature: R04 — Filter the runs history by runnable path

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And two deployed Python scripts exist at "a-<rand>" and "b-<rand>"
    And both have been run once via API and have completed

  Scenario: Navigating to /runs/<scriptPath> seeds the Path filter
    When I navigate to "/runs/u/admin/a-<rand>"
    Then the "Runs" heading is visible
    And a row referencing "a-<rand>" is visible
    And no row referencing "b-<rand>" is visible
