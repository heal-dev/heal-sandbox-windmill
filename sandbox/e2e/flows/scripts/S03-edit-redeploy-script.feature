@flow @feature:scripts @worker
Feature: S03 — Edit an existing script's body and re-deploy
  As a developer with a previously deployed script,
  I open its detail page, click Edit, modify the body, and click Deploy again,
  So that the script detail page reflects the new body and a new version is recorded.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And a deployed Python script at "u/admin/scripts-s03-<rand>" returns 'v1'

  Scenario: Re-deploy edits land back on the detail page with the new body
    Given I open the script detail page at "/scripts/get/u/admin/scripts-s03-<rand>"
    When I click the "Edit" button
    And I replace the editor body so it returns 'v2'
    And I wait for the "Autosave status" to read "Saved"
    And I click the "Deploy" button
    Then I land back on the "/scripts/get/u/admin/scripts-s03-<rand>" detail page
    And the script content for that path now returns 'v2'
