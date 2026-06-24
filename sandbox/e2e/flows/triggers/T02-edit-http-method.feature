@flow @feature:triggers @worker
Feature: T02 — Edit the HTTP method of an existing route

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed Python script exists at "u/admin/t02-<rand>"
    And an HTTP route exists at trigger path "u/admin/t02-route-<rand>" with http_method "POST"
    And I am on "/routes"

  Scenario: Open editor → switch to GET → save → row reflects GET
    When I open the route's Edit affordance
    And I click the "GET" toggle in the http_method group
    And I click "Save"
    Then the drawer closes
    And the API reports the route's http_method as "get"
