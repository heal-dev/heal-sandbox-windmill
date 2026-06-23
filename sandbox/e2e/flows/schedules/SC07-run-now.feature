@flow @feature:schedules @worker
Feature: SC07 — Trigger "Run now" on a schedule
  As a developer who owns a schedule,
  I trigger an on-demand run from the row's "Run now" action,
  So a job is enqueued and appears in the runs history.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a schedule "u/admin/sc07-<rand>" exists for a deployed script
    And I am on "/schedules"

  Scenario: Run now enqueues an immediate job for the schedule's script
    When I open the row's dropdown and click "Run now"
    And I navigate to "/runs"
    Then a row for the schedule's script appears in the runs history
