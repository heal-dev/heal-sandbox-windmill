@flow @feature:raw-apps @worker
Feature: RA01 — Create a raw HTML/JS app via API

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: POST /apps/create_raw persists a raw_app and the viewer page mounts at /apps_raw/get/<path>
    When I POST a multipart raw-app bundle to /api/w/admins/apps/create_raw at "u/admin/ra01-<rand>" with index.html, index.js
    Then GET /api/w/admins/apps/get/p/u/admin/ra01-<rand> returns the deployed row with raw_app=true and the posted summary
    And the returned value.files["index.html"].code contains the slug-stamped marker "hello-ra01-<rand>"
    And navigating to /apps_raw/get/u/admin/ra01-<rand> mounts the InWorkspaceAppViewer
    And the document <title> contains "App u/admin/ra01-<rand>"
