@flow @feature:runs-and-jobs @worker
Feature: R07 — View a failed job and see its error

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed Python script exists at "u/admin/r07-<rand>" that raises RuntimeError('boom-<rand>')
    And I have run that script once via API and waited for completion

  Scenario: The job-detail page shows the Failure badge and error payload
    When I navigate to "/run/<jobId>"
    Then the run is reported by the backend as a failure
    And the rendered result contains 'boom-<rand>'
