@flow @feature:assets @worker
Feature: AS02 — Filter the Assets DataTable by asset kind

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: ?asset_kinds=resource narrows the DataTable to resource-kind rows only
    Given a resource at "u/admin/<ns>" of type "postgresql" exists
    And a Python script at "u/admin/<ns>_script" calls `wmill.get_resource("u/admin/<ns>")`
    When I navigate to "/assets?asset_kinds=resource"
    Then the page heading "Assets" is visible
    And the resource path "u/admin/<ns>" is visible in the DataTable
    And every row's kind label is "resource"

  Scenario: ?asset_kinds=variable hides resource-kind rows
    When I navigate to "/assets?asset_kinds=variable"
    Then the resource path "u/admin/<ns>" is not present in the DataTable
    And the empty-state row "No assets found" is visible
