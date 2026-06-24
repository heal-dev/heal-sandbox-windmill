@scenario @feature:runs-and-jobs @worker
Feature: R05.S2 — Cancel button is absent on a completed job

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed Python script that returns 'hello windmill' exists at "u/admin/r05s2-<rand>"
    And I have run that script once via API and waited for completion

  Scenario: /run/<jobId> for a CompletedJob does not render the Cancel button
    When I navigate to "/run/<jobId>"
    Then the action row does not contain a "Cancel" button
