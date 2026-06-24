@flow @feature:apps @worker
Feature: A03 — Edit a deployed app's summary via API and re-deploy

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: Updating an app's summary via the update endpoint persists the new summary
    Given an app deployed at "u/admin/a03-<rand>" with summary "A03 <rand> v1"
    When I POST to /apps/update/u/admin/a03-<rand> with summary "A03 <rand> v2"
    Then GET /apps/get/p/u/admin/a03-<rand> returns summary "A03 <rand> v2"
    And navigating to /apps/get/u/admin/a03-<rand> still mounts the viewer page
