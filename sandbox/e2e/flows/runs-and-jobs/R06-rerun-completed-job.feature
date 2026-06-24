@flow @feature:runs-and-jobs @worker
Feature: R06 — Re-run a completed job from its detail page

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed Python script exists at "u/admin/r06-<rand>" that returns 'hello windmill'
    And I have run that script once via API and waited for completion

  Scenario: Clicking 'Run again' opens a fresh run page for the same script
    When I navigate to "/run/<originalJobId>"
    And I click the "Run again" button
    And I click the "Run" button on the auto-generated RunForm
    Then I land on "/run/<newJobId>" for a different job
    And the new job's result is 'hello windmill'
