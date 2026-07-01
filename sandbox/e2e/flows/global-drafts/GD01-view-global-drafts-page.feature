@flow @feature:global-drafts @worker
Feature: GD01 — View the /global_drafts inspector chrome

  Background:
    Given I am signed in as "admin@windmill.dev"
    And the seeded "admins" workspace is selected
    And localStorage.wm_dev_global_ai is "1" (the dev gate that mounts /global_drafts)

  Scenario: /global_drafts renders h1 "Global local drafts" and the Clear all button
    When I GET "/api/w/admins/drafts/list"
    Then the response is 200 and the body is a JSON array
    When I navigate to "/global_drafts"
    Then the document title contains "Global AI drafts"
    And the h1 "Global local drafts" is visible
    And a Button labelled "Clear all" is visible
