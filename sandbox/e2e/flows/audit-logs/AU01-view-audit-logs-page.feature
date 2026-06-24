@flow @feature:audit-logs @worker
Feature: AU01 — View the Audit logs page (h1, redaction alert, table headers)

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And I am on "/audit_logs"

  Scenario: /audit_logs renders the page heading, the CE redaction alert, the column headers, and at least one row
    Then the document title contains "Windmill"
    And the page heading "Audit logs" is visible
    And the text "You need an enterprise license to see unredacted audit logs." is visible
    And the column headers "ID", "Timestamp", "Username", "Operation", "Resource" are visible
    And at least one audit_log row exists at /api/w/admins/audit/list (precondition)
