@flow @feature:audit-logs @worker
Feature: AU03 — Performing a script create+delete appends new audit_log rows

  Background:
    Given I am signed in as "admin@windmill.dev"
    And I record the current max audit_log id at /api/w/admins/audit/list

  Scenario: Creating then deleting a script raises the max audit_log id by at least 2
    When I POST /api/w/admins/scripts/create with a no-arg Python script
    And I POST /api/w/admins/scripts/delete/p/<scriptPath>
    Then GET /api/w/admins/audit/list returns at least one row newer than the recorded baseline
    And the new rows' username is "admin@windmill.dev"
    And the new rows' action_kind set includes at least "Create" and "Delete"
