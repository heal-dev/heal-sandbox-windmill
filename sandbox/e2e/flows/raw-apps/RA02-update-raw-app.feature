@flow @feature:raw-apps @worker
Feature: RA02 — Update a raw app's HTML/JS via API

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: POST /apps/update_raw/<path> replaces the bundle bytes and bumps the version
    Given a raw app deployed at "u/admin/ra02-<rand>" with index.html containing "hello-ra02-<rand>-v1"
    When I POST a multipart update to /api/w/admins/apps/update_raw/u/admin/ra02-<rand> with new index.html "hello-ra02-<rand>-v2"
    Then GET /api/w/admins/apps/get/p/u/admin/ra02-<rand> returns the new summary "RA02 <rand> v2"
    And the returned value.files["index.html"].code contains the v2 marker
    And the returned versions array now has at least 2 entries
    And navigating to /apps_raw/get/u/admin/ra02-<rand> still mounts the viewer page (document <title> contains "App u/admin/ra02-<rand>")
