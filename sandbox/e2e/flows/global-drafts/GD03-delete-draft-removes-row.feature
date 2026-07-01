@flow @feature:global-drafts @worker
Feature: GD03 — Deleting a draft removes its row from /global_drafts

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And localStorage.wm_dev_global_ai is "1"
    And a fresh slug "<slug>" and draft path "u/admin/gd03-<slug>"
    And a draft has been POSTed at that path so a row renders

  Scenario: Deleting via the discard endpoint removes the row from the list
    Given /global_drafts is open and a row for "u/admin/gd03-<slug>" is visible
    When I POST /api/w/admins/drafts/update/script/u/admin/gd03-<slug> with {value: null}
    Then the response is 200 with status "saved"
    And GET /api/w/admins/drafts/list does NOT contain a row at "u/admin/gd03-<slug>"
    When I reload /global_drafts
    Then no cell whose text contains "u/admin/gd03-<slug>" is visible
