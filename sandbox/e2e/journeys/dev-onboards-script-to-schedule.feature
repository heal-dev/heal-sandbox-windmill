@journey @e2e @worker
Feature: A new developer ships a scheduled Python script end-to-end
  As a new developer signing in to Windmill for the first time,
  I want to create a workspace, write a Python script, run it from its
  auto-generated UI, and schedule it on a cron,
  So that I can prove the platform supports the full author-to-schedule loop.

  Background:
    Given I am signed in as "admin@windmill.dev"
    And I open the "Workspace picker" at "/user/workspaces"

  Scenario: From workspace creation to a scheduled run
    When I click the "+ Create a new workspace" link
    And I fill the "Workspace name" field with "Acme"
    And I fill the "Workspace ID" field with a unique workspace id        # produces: workspaceId
    And I click the "Create workspace" button
    Then I land on the workspace home at "/"                              # consumes: workspaceId

    When I click the "Script" button in the header
    Then I land on the "Script editor" with a draft path under "u/admin@windmill.dev/"

    When I click the "Python" language tile
    And I click the "Deploy" button                                       # produces: scriptPath
    Then I land on the script detail page under "/scripts/get/"

    When I fill the required "no_default" field with "journey-run"
    And I submit the auto-generated run form via the "Run" button         # produces: jobId
    Then I land on the job detail page under "/run/"                      # consumes: jobId
    And the job status reads "Success"

    When I return to the script detail page
    And I open the "Triggers" tab in the script-detail right pane
    And I click the "Add trigger" button
    And I choose "Schedule" from the trigger types
    And in the schedule editor I set the "Cron" field to "* * * * *"
    And I click the "Deploy" button on the script-detail page             # produces: scheduleId

    When I navigate to "Schedules" from the sidebar
    Then a schedule row with cron "* * * * *" is visible on the Schedules page   # consumes: scheduleId

    When I navigate to "Runs" from the sidebar
    Then a completed run for my script appears in the Runs history table   # consumes: jobId
