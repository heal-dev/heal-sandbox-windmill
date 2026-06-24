@flow @feature:apps @worker
Feature: A04 — Delete an app via API

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: Deleting an app removes it from the list and 404s on /apps/get/p/<path>
    Given an app deployed at "u/admin/a04-<rand>"
    When I DELETE /api/w/admins/apps/delete/u/admin/a04-<rand>
    Then GET /api/w/admins/apps/list does not contain "u/admin/a04-<rand>"
    And GET /api/w/admins/apps/get/p/u/admin/a04-<rand> returns HTTP 404
