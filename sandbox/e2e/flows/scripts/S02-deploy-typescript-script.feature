@flow @feature:scripts @worker
Feature: S02 — Author and deploy a TypeScript (Bun) script from Home
  As a developer,
  I open the Script editor from Home and pick the TypeScript (Bun) language,
  So that after replacing the body with a no-arg hello-windmill script and
  clicking Deploy I land on the script detail page with its run UI.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And I am on Home at "/"

  Scenario: Switch language to TypeScript (Bun) and deploy a hello script
    When I click the "Script" CTA on Home
    And I click the "TypeScript (Bun)" tile in the Language picker
    And I replace the editor body with a no-arg hello-windmill Bun script
    And I wait for the "Autosave status" to read "Saved"
    And I click the "Deploy" button
    Then I land on a "/scripts/get/" detail page
    And the auto-generated run form shows a "Run" button
