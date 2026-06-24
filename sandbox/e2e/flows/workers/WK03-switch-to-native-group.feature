@flow @feature:workers @worker
Feature: WK03 — Switch worker-group tab to "native" and see its workers

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And I am on "/workers"

  Scenario: Clicking the "native" tab reveals the native worker rows and its config tags
    When I click the tab whose accessible name matches /^native\s+\d+\s+workers?$/
    Then the section heading "Active workers" is visible
    And at least one row whose worker name starts with "wk-native" is visible
    And the search box placeholder is "Search workers in group 'native'"
