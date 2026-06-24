@flow @feature:flows @worker
Feature: F02 — Run a deployed flow from its detail page

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a 2-step Python flow exists at "u/admin/f02-<rand>"

  Scenario: Submitting the auto-generated Run form lands on the job detail
    When I navigate to "/flows/get/u/admin/f02-<rand>"
    And I click the "Run" button on the auto-generated RunForm
    Then I land on "/run/<jobId>"
    And the flow's per-step echo result is visible on the page
