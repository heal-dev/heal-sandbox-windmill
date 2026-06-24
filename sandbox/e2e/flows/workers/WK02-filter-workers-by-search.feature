@flow @feature:workers @worker
Feature: WK02 — Filter active workers by search query in the current group

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And I am on "/workers"

  Scenario: Typing into the group search input narrows the table to matching workers
    When I fill the "Search workers in group 'default'" input with "wk-default"
    Then at least one row referencing a "wk-default" worker is visible
    When I fill the "Search workers in group 'default'" input with "no-such-worker-zzz"
    Then the table renders "No active workers found matching the search query"
