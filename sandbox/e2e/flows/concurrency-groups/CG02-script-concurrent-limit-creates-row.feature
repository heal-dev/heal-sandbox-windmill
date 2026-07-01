@flow @feature:concurrency-groups @worker
Feature: CG02 — Concurrent-limited script + parallel runs surfaces a row on /concurrency_groups

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: A script with concurrent_limit=1 and two parallel runs produces a /concurrency_groups row keyed by its concurrency_key
    Given a fresh slug "<slug>" and concurrency_key "cg02_<slug>"
    When I POST "/api/w/admins/scripts/create" with concurrent_limit=1, concurrency_time_window_s=30, concurrency_key="cg02_<slug>" and a Python body that sleeps 8s
    And I POST "/api/w/admins/jobs/run/p/u/admin/cg02-<slug>" twice in succession
    Then GET "/api/concurrency_groups/list" eventually contains a row whose concurrency_key is "cg02_<slug>"
    When I navigate to "/concurrency_groups"
    Then the th "Concurrency key" is visible
    And the th "Jobs running" is visible
    And a link whose accessible name is "cg02_<slug>" is visible
