@flow @feature:concurrency-groups @worker
Feature: CG03 — Prune removes an idle concurrency group from /list

  Background:
    Given I am signed in as "admin@windmill.dev"

  Scenario: Pruning an idle concurrency group returns 200 and removes its row from /list
    Given a script with concurrent_limit=1 + concurrency_key "cg03_<slug>" has run once to completion
    When I DELETE "/api/concurrency_groups/prune/cg03_<slug>"
    Then the response status is 200
    And subsequent GET "/api/concurrency_groups/list" does NOT contain a row with concurrency_key="cg03_<slug>"
