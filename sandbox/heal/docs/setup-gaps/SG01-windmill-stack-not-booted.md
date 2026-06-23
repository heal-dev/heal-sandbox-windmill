## Setup gap: Windmill stack is not running on the host — the journey walk cannot reach any UI screen.

> A substitution/seed the sandbox lacks — NOT a product defect (heal/docs/setup-gaps/SG01-windmill-stack-not-booted.md).

**Where.** home

**Detail.** The skeleton authored docker-compose-based boot in sandbox/scripts/infra-up.sh that depends on `docker compose` from the bundled windmill/docker-compose.yml. `docker` is not installed on this machine, so neither the backend (`http://localhost/api/version`) nor the frontend (`http://localhost`) responds. The walk subagent would hit a blocked entry on the very first screen (sign-in / workspaces).

**Pick a fidelity rung (most-real first):**
- `real`
- `dev-instance`
- `seed`
- `mock`
- `out-of-scope`

**Notes.**
- real: install Docker Desktop and run sandbox/scripts/infra-up.sh (the path chosen at the skeleton boundary phase)
- dev-instance: switch boot to the AGENTS.md cargo+npm path (start-dev-db.sh + cargo run + npm run dev) — requires Rust toolchain + node; first cargo build is long
- out-of-scope: skip the walk now and resume in a future session once the stack is bootable

