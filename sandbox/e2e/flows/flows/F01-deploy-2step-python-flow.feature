@flow @feature:flows @worker
Feature: F01 — Deploy a 2-step Python flow from Home

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: A deployed 2-step Python flow lands on its detail page
    Given a 2-step Python flow has been deployed at "u/admin/f01-<rand>"
    When I navigate from Home via the "Flow" CTA
    And I navigate to "/flows/get/u/admin/f01-<rand>"
    Then the flow's detail page loads with its summary and graph nodes
