@flow @feature:audit-logs @worker
Feature: AU02 — Filter audit logs by action_kind (Create) returns only Create rows

  Background:
    Given I am signed in as "admin@windmill.dev"

  Scenario: GET /audit/list?action_kind=create returns only rows whose action_kind is "Create"
    When I GET "/api/w/admins/audit/list?per_page=20&action_kind=create"
    Then the response status is 200
    And every returned row has action_kind == "Create"
    When I GET "/api/w/admins/audit/list?per_page=20&action_kind=delete"
    Then the response status is 200
    And every returned row has action_kind == "Delete"
    When I GET "/api/w/admins/audit/list?action_kind=Create" (capitalised value)
    Then the response status is 500 with a Postgres enum error (lowercase enforced)
