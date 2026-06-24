@flow @feature:workers @worker
Feature: WK01 — View the Workers page and at least one live worker row

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And I am on "/workers"

  Scenario: /workers renders the Workers PageHeader, the worker-group Tabs, and at least one alive worker row
    Then the document title is "Workers"
    And the page heading "Workers" is visible
    And a tab whose accessible name matches /^default\s+\d+\s+workers?$/ is visible
    And a tab whose accessible name matches /^native\s+\d+\s+workers?$/ is visible
    And the "Active workers" section is visible
    And at least one row whose Status cell renders the "Alive" badge is visible
