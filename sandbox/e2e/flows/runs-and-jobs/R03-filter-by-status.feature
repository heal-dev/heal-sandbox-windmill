@flow @feature:runs-and-jobs @worker
Feature: R03 — Filter the runs history by status

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed Python script "ok-<rand>" exists that returns 'hello windmill'
    And a deployed Python script "fail-<rand>" exists that raises RuntimeError
    And both scripts have been run once via API and have completed

  Scenario: Filtering /runs by Status=Success narrows to only successful rows
    When I navigate to "/runs" with status filter set to "success"
    Then the row for the passing script is visible
    And no row for the failing script is visible
