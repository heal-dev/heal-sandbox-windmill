## Setup gap: Sandbox already holds 2 user workspaces from prior runs; Windmill CE caps non-admin workspaces at 2, so POST /api/workspaces/create returns 400 and the walk can't create a new workspace through the UI.

> A substitution/seed the sandbox lacks — NOT a product defect (heal/docs/setup-gaps/SG-workspace-cap.md).

**Where.** workspace-create

**Detail.** Click 'Create workspace' on /user/create_workspace produced POST /api/workspaces/create → 400 'You have reached the maximum number of workspaces (2 outside of default workspace admins) without an enterprise license.' GET /api/workspaces/list shows [acme-qf3q9, acme-nfgrp] left over from earlier discovery-walk runs. Test never navigates off /user/create_workspace; waitForURL(/\/(?:$|\?)/) times out after 60s.

**Pick a fidelity rung (most-real first):**
- `real`
- `dev-instance`
- `seed`
- `mock`
- `out-of-scope`

**Notes.**
- real: pre-test teardown deletes/archives leftover Acme workspaces via API before each journey run (natural fit; journey already uses unique IDs)
- seed: reset Windmill DB / docker-compose volume to wipe leftover workspaces before the suite runs
- mock: out-of-scope — the journey's whole purpose is to walk workspace-create through the real UI
- dev-instance: provision a fresh non-shared Windmill instance per journey run

