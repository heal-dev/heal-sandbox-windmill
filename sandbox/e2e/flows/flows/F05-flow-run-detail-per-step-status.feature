@flow @feature:flows @worker
Feature: F05 — Per-step status on a completed flow run

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a 2-step Python flow has been deployed and successfully run at "u/admin/f05-<rand>"

  Scenario: The /run page surfaces per-step status for both modules
    When I navigate to "/run/<jobId>" for the completed flow job
    Then the FlowProgressBar shows the two module step IDs ("a", "b")
    And both module statuses render as successful
