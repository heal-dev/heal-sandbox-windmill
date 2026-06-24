@flow @feature:triggers @worker
Feature: T03 — Delete an HTTP route from /routes

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed Python script exists at "u/admin/t03-<rand>"
    And an HTTP route exists at trigger path "u/admin/t03-route-<rand>"
    And I am on "/routes"

  Scenario: Open kebab → Delete → row disappears
    When I open the row's dropdown
    And I click "Delete"
    Then the row for the route is no longer visible
    And the API reports the route as deleted (GET returns 404)
