@journey @journey:builder-ships-internal-app @worker
Feature: A builder turns a script into a low-code app, publishes it, and shares it with a group
  As a developer wearing the builder hat,
  I want to take an existing Python script, wrap it in a low-code app whose button invokes the script,
  publish the app at /apps/get/<path>, create a group, grant the group write access to the app,
  and confirm the published app still renders for the owner,
  So that I can prove the platform supports the full script -> app -> share-with-group loop a builder owns.

  Background:
    Given I am signed in as "admin@windmill.dev" via reused Playwright storageState
    And localStorage.workspace is seeded to "admins"

  Scenario: From an existing script to a shared internal app
    # Step 1 — script precondition (API-shortcut: Monaco is fragile per spec walkNotes)
    Given a Python script is deployed via POST /api/w/admins/scripts/create at "u/admin/builder-script-<slug>" returning "hello-<slug>"

    # Step 2 — author + deploy the app via API (builder drag-drop forbidden per apps feature walkNote)
    When I POST a buttonAppValue to /api/w/admins/apps/create at path "u/admin/builder-app-<slug>"
    Then the response is 201 and the returned path matches the requested path

    # Step 3 — navigate to the viewer; the on-host signal is the document title
    When I navigate to "/apps/get/u/admin/builder-app-<slug>"
    Then the document title matches /App\s+u\/admin\/builder-app-<slug>.*Windmill/i   # web-first matcher, web-first vocab

    # Step 4 — create a group via the /groups UI (UP04.S1 vocabulary)
    When I navigate to "/groups"
    Then the heading "Groups" is visible
    When I click "New group"
    And I fill the popover input "New group name" with "builders-<slug>"
    And I click "Create"
    Then a row with the group name is visible on /groups

    # Step 5 — share the app with the group via the generic granular_acls endpoint
    # (there is no app-side perms UI — confirmed by walk; apps router has no setpath/perms route)
    When the harness POSTs to "/api/w/admins/acls/add/app/u/admin/builder-app-<slug>" with {owner: "g/builders-<slug>", write: true}
    Then the response is 2xx
    And GET "/api/w/admins/acls/get/app/u/admin/builder-app-<slug>" returns {"g/builders-<slug>": true}

    # Step 6 — re-visit /apps/get/<path>; the group grant did not break owner visibility
    When I navigate back to "/apps/get/u/admin/builder-app-<slug>"
    Then the document title still matches /App\s+u\/admin\/builder-app-<slug>.*Windmill/i
