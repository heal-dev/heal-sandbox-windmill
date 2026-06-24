@flow @feature:folders @worker
Feature: FD04 — A script deployed under f/<folder>/ is owned by the folder

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And folder "fd04-<rand>" exists
    And a deployed Python script exists at "f/fd04-<rand>/myscript"

  Scenario: Folder usage and the /folders row's Scripts cell reflect the script
    When I GET /api/w/admins/folders/getusage/fd04-<rand>
    Then the response body has scripts >= 1
    And on /folders the row whose Name cell contains "fd04-<rand>" shows "1" in the Scripts column
