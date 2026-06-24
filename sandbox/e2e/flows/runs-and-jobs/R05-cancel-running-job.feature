@flow @feature:runs-and-jobs @worker
Feature: R05 — Cancel a running job from its detail page

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed Python script exists that sleeps for 60 seconds
    And I have launched the script via API and captured its jobId

  Scenario: Clicking Cancel on /run/<jobId> transitions the job to Canceled
    When I navigate to "/run/<jobId>" while the job is Running
    And I click the "Cancel" button
    Then the backend reports the job as canceled
