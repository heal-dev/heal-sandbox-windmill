@scenario @feature:workspaces @invariant @readonly
Feature: W01.S2 — Workspace ID slug regex rejects bad values
  As Windmill,
  I reject any "Workspace ID" that doesn't match the slug regex ^\w+(-\w+)*$,
  So that workspace IDs stay URL-safe.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And I open the Create Workspace page at "/user/create_workspace"

  Scenario: Filling "Workspace ID" with an invalid value disables the Create button
    Then the "Create workspace" button is enabled only with a valid slug

    When I fill the "Workspace name" field with "Acme"
    And I fill the "Workspace ID" field with "Invalid ID!"
    Then the "Create workspace" button is disabled
