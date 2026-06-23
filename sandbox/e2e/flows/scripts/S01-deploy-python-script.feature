@flow @feature:scripts @worker
Feature: S01 — Author and deploy a Python script from the workspace home
  As a developer in a fresh workspace,
  I open the Script editor from Home, pick Python, replace the body with a
  no-arg hello-windmill script, and Deploy,
  So that I land on the script detail page with its auto-generated run UI.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And I am on Home at "/"

  Scenario: Deploy a Python script and land on its run page
    When I click the "Script" CTA on Home
    And I click the "Python" tile in the Language picker
    And I replace the editor body with a no-arg hello-windmill Python script
    And I wait for the "Autosave status" to read "Saved"
    And I click the "Deploy" button
    Then I land on a "/scripts/get/" detail page
    And the auto-generated run form shows a "Run" button
