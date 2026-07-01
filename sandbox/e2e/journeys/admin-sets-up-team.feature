@journey @journey:admin-sets-up-team @worker
Feature: An admin stands up a team workspace, invites a teammate, organises them into a group + folder, and reviews activity in audit logs
  As a workspace admin signed in to the seeded Windmill instance,
  I want to create a fresh team workspace, invite a teammate via Workspace Settings,
  create a group and a folder, drop a folder-scoped variable to prove the ACL is wired,
  and then verify the prior mutations have generated audit-log activity,
  So that I can prove the platform supports the full provision -> permission -> audit loop a team admin owns.

  Background:
    Given I am signed in as "admin@windmill.dev" via reused Playwright storageState
    And the seeded 'admins' workspace exists                                       # the journey explicitly leaves admins behind on its first step

  Scenario: From new workspace to audited team setup
    When I navigate to "/user/workspaces" (workspace picker)
    And I click the link "+ Create a new workspace"
    Then I land on "/user/create_workspace" with heading "New Workspace"

    When I fill "Workspace name" with "Team <slug>"
    And I fill "Workspace ID" with "team-<slug>"
    And I click "Create workspace"                                                 # produces: teamWorkspaceId
    Then I land on "/" and the Home heading is visible
    And localStorage.workspace becomes "team-<slug>"

    When I navigate to "/workspace_settings?tab=users"                             # no role=tab; URL-query driven per walk
    Then the heading "Workspace settings: team-<slug>" is visible
    And the heading "Members (1)" is visible

    When I click "Add new user"
    And I fill the only textbox with aria-label "email" with "member-<slug>@example.com"
    And I submit the inline add-user form                                          # produces: inviteeEmail
    Then the heading "Members (2)" is visible                                      # immediate add in fresh non-admins workspace
    And the invitee email appears in the Members table

    When I navigate to "/groups"
    Then the heading "Groups" is visible

    When I click "New group"
    And I fill the popover input "New group name" with "team-group-<slug>"
    And I click "Create"                                                            # produces: groupName
    Then a row with the group name is visible on /groups

    # VERIFY: walk confirmed POST /groups/adduser/<group> with admin owner is auto/idempotent.
    When the harness POSTs to "/api/w/team-<slug>/groups/adduser/team-group-<slug>" with {username: "admin"}
    Then the response is 2xx (idempotent: admin already a member)

    When I navigate to "/folders"
    Then the heading "Folders" is visible

    When I click "New folder"
    And I fill the popover input "New folder name" with "team-folder-<slug>"
    And I click "Create"                                                            # produces: folderName
    Then a row with the folder name is visible on /folders
    And the FolderEditor drawer opens in place (drawer title rendered as plain text "Folder team-folder-<slug>")

    When the harness POSTs to "/api/w/team-<slug>/variables/create" with path "f/team-folder-<slug>/probe-<slug>" and value "audit-seed"   # api-shortcut per walk: seeds an audit row, not the admin's headline mutation
    Then the response is 2xx

    When I navigate to "/audit_logs"
    Then the document title matches /Audit Logs.*Windmill/i
    And the heading "Audit logs" is visible
    And the Alert "You need an enterprise license to see unredacted audit logs." is visible
    # UI rows are 0 on CE-no-license; assert API row count > 0 instead per walk corrections
    And GET "/api/w/team-<slug>/audit/list" returns at least one row
