@flow @feature:apps @worker
Feature: A01 — Create and deploy a minimal app via API

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: POST /apps/create persists the app and the viewer mounts at /apps/get/<path>
    When I POST a minimal app value to /api/w/admins/apps/create at "u/admin/a01-<rand>"
    Then GET /api/w/admins/apps/get/p/u/admin/a01-<rand> returns the deployed row
    And navigating to /apps/get/u/admin/a01-<rand> mounts the InWorkspaceAppViewer
    And the document <title> contains "App u/admin/a01-<rand>"
