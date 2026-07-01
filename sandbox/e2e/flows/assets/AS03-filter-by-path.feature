@flow @feature:assets @worker
Feature: AS03 — Filter the Assets DataTable by asset_path pattern

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected

  Scenario: ?asset_path=<slug> narrows the DataTable to rows whose path matches
    Given a resource at "u/admin/<ns>" of type "postgresql" exists
    And a Python script at "u/admin/<ns>_script" calls `wmill.get_resource("u/admin/<ns>")`
    When I navigate to "/assets?asset_path=<ns>"
    Then the page heading "Assets" is visible
    And the resource path "u/admin/<ns>" is visible in the DataTable

  Scenario: ?asset_path=<no-such-thing> renders the empty-state row
    When I navigate to "/assets?asset_path=no_such_asset_path_xyz"
    Then the empty-state row "No assets found" is visible
