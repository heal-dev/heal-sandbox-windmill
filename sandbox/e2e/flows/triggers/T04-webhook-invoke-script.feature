@flow @feature:triggers @worker
Feature: T04 — Invoke a deployed script via its per-runnable webhook

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed Python script returning 'hello-<rand>' exists at "u/admin/t04-<rand>"

  Scenario: POST run_wait_result returns the script output and a runs row appears
    When I POST to /api/w/admins/jobs/run_wait_result/p/<script_path> with an empty body
    Then the response body is 'hello-<rand>'
    And navigating to /runs shows a row referencing the script slug
