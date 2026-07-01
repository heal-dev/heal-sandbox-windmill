@flow @feature:assets @worker
Feature: AS01 — View the Assets page and see a resource registered by a script

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: A resource referenced by a deployed script surfaces in the Latest assets DataTable
    Given a resource at "u/admin/<ns>" of type "postgresql" exists
    And a Python script at "u/admin/<ns>" calls `wmill.get_resource("u/admin/<ns>")`
    When I navigate to "/assets"
    Then the document title is "Assets | Windmill"
    And the page heading "Assets" is visible
    And the "All workspace assets" section is visible
    And the "Latest assets used" section is visible
    And the cards "Data table", "Ducklake", and "Object storage" are visible
    And a row whose text matches the resource path "u/admin/<ns>" is visible
    And a "1 usage" link in that row is visible
