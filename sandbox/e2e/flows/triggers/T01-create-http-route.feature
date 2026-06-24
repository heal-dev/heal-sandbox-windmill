@flow @feature:triggers @worker
Feature: T01 — Create an HTTP route from /routes that targets a deployed script

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed Python script exists at "u/admin/t01-<rand>"
    And I am on "/routes"

  Scenario: New route → pick script → save → row visible
    When I click "New route"
    And in the editor I pick the deployed script as the runnable
    And I fill the route_path "Path" textbox with "t01-<rand>"
    And I leave http_method on "POST"
    And I click "Save"
    Then the drawer closes
    And a row referencing the route at "u/admin/t01-<rand>" is visible at /routes
