@flow @feature:apps @worker
Feature: A02 — Deployed app with a button-runnable persists its inline script

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: App with a buttoncomponent backed by an inline Python script is persisted
    When I POST an app at "u/admin/a02-<rand>" whose value has a single buttoncomponent with an inline Python script returning "hello-<rand>"
    Then GET /apps/get/p/u/admin/a02-<rand> returns the app
    And the returned value.grid[0].data.componentInput.runnable.inlineScript.content contains "hello-<rand>"
    And navigating to /apps/get/u/admin/a02-<rand> mounts the viewer
