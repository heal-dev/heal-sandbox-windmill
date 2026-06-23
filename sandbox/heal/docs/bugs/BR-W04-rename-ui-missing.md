## Bug: Workspace name editor missing on /workspace_settings?tab=general

> Found by: heal cover P5 verify-feature (workspaces)

**Symptom.** /workspace_settings?tab=general renders the h2 "General" heading but no rename input — admins cannot change the workspace name through the documented UI path.

**Repro.**
1. docker compose up -d (Windmill stack)
2. Sign in as admin@windmill.dev / changeme
3. Set localStorage.workspace = 'admins' (or any workspace where you are admin)
4. Open /workspace_settings?tab=general
5. Observe: h1 'Workspace settings: admins', h2 'General', and no rename input. The backend endpoint POST /api/w/admins/workspaces/change_workspace_name is wired and works via curl.

**Expected.** Per spec W04.S2 and the ChangeWorkspaceName/ChangeWorkspaceColor components in workspace_settings/+page.svelte:1219, an admin viewing /workspace_settings?tab=general should see a 'Workspace name' input pre-filled with the current name and a 'Save' button that hits POST /api/w/&lt;id&gt;/workspaces/change_workspace_name.

**Actual.** DOM probes (both on the seeded `admins` workspace and a freshly-created `acme-probe`) show zero &lt;input&gt; elements anywhere on the page after navigating to /workspace_settings?tab=general. The text 'Workspace name' is present once but no associated input is rendered; the General section is just `&lt;div class='flex-1 min-w-0'&gt;&lt;h2&gt;General&lt;/h2&gt;&lt;/div&gt;`. Other Settings buttons render fine ('Archive workspace', 'Delete workspace (superadmin)').

**Evidence.** heal-traces from the workspaces feature run (W04 timed out trying to fill 'Workspace name' input); probe scripts run out-of-band show the same.

**Likely location.**
- windmill/frontend/src/routes/(root)/(logged)/workspace_settings/+page.svelte:1219
- windmill/frontend/src/lib/components/workspaceSettings/ChangeWorkspaceName.svelte

**Hypothesis.** Possible regression after a refactor of the workspace_settings General tab — the embedded ChangeWorkspaceName / ChangeWorkspaceColor components may have been gated behind a condition that no longer matches the seeded admin (or the components are mounting into a hidden parent).

**Task.** workspaces

