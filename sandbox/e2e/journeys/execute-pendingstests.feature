@journey @e2e @worker
Feature: A developer executes a script and confirms the pending run completes
  As a developer already signed in to a Windmill workspace,
  I want to author a script in the editor, run it, and see the run finish,
  So that I can prove a script becomes an executable job whose successful
  result is observable end-to-end in the runs history.

  Background:
    Given I am signed in as "admin@windmill.dev" with the "Admins" workspace selected
    And I open the workspace home at "/"

  Scenario: From authoring a script to a completed run in the runs history
    # STEP 1 — script-editor (feature: scripts) — consumes: workspaceId
    When I click the "Script" button in the header
    Then I land on the "Script editor" with a draft path under "u/admin@windmill.dev/"

    When I click the "Python" language tile
    And I replace the editor body with a no-argument script returning "hello windmill"
    And I wait for the "Autosave status" to read "Saved"
    And I click the "Deploy" button                                       # produces: scriptPath
    Then I land on the script detail page under "/scripts/get/"

    # STEP 2 — run-page / job-detail (feature: runs-and-jobs) — consumes: scriptPath
    When I submit the auto-generated run form via the "Run" button        # produces: jobId
    Then I land on the job detail page under "/run/"
    And the pending run transitions to "Success"
    And the result panel renders "hello windmill"

    # STEP 3 — runs-history (feature: runs-and-jobs) — consumes: jobId
    When I navigate to "Runs" from the sidebar
    Then the runs history table lists completed runs with a "See run detail" link
    And opening my run's detail confirms it reads "Success" with result "hello windmill"
