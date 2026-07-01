@flow @feature:concurrency-groups @worker
Feature: CG01 — View the Concurrency Groups page chrome

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: /concurrency_groups renders PageHeader 'Concurrency Groups' and the Refresh button
    When I GET "/api/concurrency_groups/list"
    Then the response is 200 and the body is a JSON array
    When I navigate to "/concurrency_groups"
    Then the document title contains "Concurrency groups"
    And the page heading "Concurrency Groups" (capital G) is visible
    And a Button labelled "Refresh" is visible
