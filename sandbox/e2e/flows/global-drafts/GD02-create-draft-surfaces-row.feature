@flow @feature:global-drafts @worker
Feature: GD02 — A draft created via the API surfaces on /global_drafts

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And localStorage.wm_dev_global_ai is "1"
    And a fresh slug "<slug>" and draft path "u/admin/gd02-<slug>"

  Scenario: A POSTed script draft appears in the /global_drafts list
    When I POST /api/w/admins/drafts/update/script/u/admin/gd02-<slug> with {value: <NewScript shape>}
    Then the response is 200 with status "saved"
    And GET /api/w/admins/drafts/list contains a row with kind="script" and path="u/admin/gd02-<slug>"
    When I navigate to /global_drafts
    Then the h1 "Global local drafts" is visible
    And a cell whose text contains "u/admin/gd02-<slug>" is visible
    And the text "script" appears alongside the draft (the row prefix renders the kind label)
