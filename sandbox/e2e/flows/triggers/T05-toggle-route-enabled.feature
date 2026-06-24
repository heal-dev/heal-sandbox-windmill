@flow @feature:triggers @worker
Feature: T05 — Toggle an HTTP route's enabled state from /routes

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed Python script exists at "u/admin/t05-<rand>"
    And an enabled HTTP route exists at trigger path "u/admin/t05-route-<rand>"
    And I am on "/routes"

  Scenario: Flip the row's TriggerModeToggle from enabled → disabled
    When I click the route row's enable/disable toggle
    Then the API reports the route's mode as "disabled"
