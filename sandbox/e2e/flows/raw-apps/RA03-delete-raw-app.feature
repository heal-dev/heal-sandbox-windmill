@flow @feature:raw-apps @worker
Feature: RA03 — Delete a raw app via API

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: DELETE /apps/delete/<path> removes a raw_app row and 404s on /apps/get/p/<path>
    Given a raw app deployed at "u/admin/ra03-<rand>"
    When I DELETE /api/w/admins/apps/delete/u/admin/ra03-<rand>
    Then GET /api/w/admins/apps/get/p/u/admin/ra03-<rand> returns HTTP 404
    And the workspace Apps home tab does not contain the deleted path "u/admin/ra03-<rand>"
