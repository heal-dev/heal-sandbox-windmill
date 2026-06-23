@flow @feature:workspaces @readonly
Feature: W03 — Visiting a feature route without a workspace redirects to the picker
  As a developer with no workspace currently selected,
  When I open any (logged) feature route,
  I am redirected to the workspace picker so I select one first.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And no workspace is selected (localStorage.workspace is empty)

  Scenario: Opening /scripts/add without a workspace lands on the picker
    When I navigate to "/scripts/add"
    Then I land on "/user/workspaces" with a "?rd=" parameter pointing back to "/scripts/"
    And the "Select a workspace" heading is visible
