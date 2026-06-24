@flow @feature:flows @worker
Feature: F03 — Edit a flow and append a step

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a 1-step Python flow exists at "u/admin/f03-<rand>"

  Scenario: Re-deploying a flow with an added step reflects in its detail page
    When the flow is updated to add a second Python step
    And I navigate to "/flows/get/u/admin/f03-<rand>"
    Then the new step's summary is visible on the detail page
