@flow @feature:runs-and-jobs @worker
Feature: R01 — Run a deployed script from its detail page

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed Python script exists at "u/admin/r01-<rand>" that returns 'hello windmill'

  Scenario: Submitting the auto-generated Run form lands on the job detail
    When I navigate to "/scripts/get/u/admin/r01-<rand>"
    And I click the "Run" button on the auto-generated RunForm
    Then I land on "/run/<jobId>"
    And the script's return value "hello windmill" is visible on the page
