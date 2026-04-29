# CafeDuo Project Progress

## Operating Rule
- Read this file before running project commands.
- Keep notes short and current to save context and avoid repeating old investigation.

## Current Goal
- Keep GitHub checks green and continue post-MVP polish from a stable baseline.

## Current State
- CI failure fix done locally: npm audit vulnerabilities were resolved with dependency updates/overrides.
- Deploy failure fix done locally: VPS workflow reconciles legacy/empty migration state before strict migration status.
- `main` includes the MVP/socket/OpenAPI hardening work pushed after `a93917b Harden multiplayer socket rooms`.
- XPatla-inspired dark/red UI is applied.
- Cafe creation/admin assignment fixes were implemented with migration `20260429123000_align_cafe_schema_columns.js`.
- Socket MVP fix done: game rooms require participant/admin access before join and require room membership before move/state broadcasts.
- OpenAPI duplicate `/api/games/{id}` path fixed; duplicate Swagger registration removed.
- Confirmed markdown cleanup done: removed stale agent notes, roadmap/development plan, task notes, and old presentation note.
- Docs refresh done: README, DEPLOYMENT, SECURITY, and OPTIMIZATIONS describe the current MVP/Dokploy state.
- Deploy hardening done: compose defaults fail closed for Redis/rate-limit auth behavior and pass bootstrap admin/build metadata envs explicitly.
- MVP baseline is complete locally: user auth/check-in, cafe/admin flows, two-player games, rewards, build, and E2E gates pass.
- Local DB was unreachable during the last migration status check, so migration up/down could not be verified locally.
- Latest validation: `npm audit --audit-level=moderate`, workflow/OpenAPI/compose YAML parse, backend/migration syntax checks, `test:ci` (812 tests), CI-equivalent `test:coverage` (812 tests), `build`, and `test:e2e` (14 tests) passed.

## Active Constraints
- Do not delete local files without action-time confirmation.
- Keep AGENTS.md rules: no `SELECT *`, add limits to user-facing queries, schema changes via migrations.
- Use `npm.cmd`/`npx.cmd` on Windows.

## Next Steps
- Push the CI/deploy failure fix and verify the new GitHub Actions runs.

## Markdown Cleanup
- Keep: AGENTS.md, README.md, DEPLOYMENT.md, SECURITY.md, OPTIMIZATIONS.md, migrations/README.md, backend/handlers/game/README.md, public/assets/games/ATTRIBUTION.md, .github/pull_request_template.md.
- Deleted after user confirmation: .agent/STATE.md, .agent/workflows/*.md, DEVELOPMENT_PLAN.md, ROADMAP.md, tasks/lessons.md, tasks/todo.md, docs/presentation/cafeduo-profesyonel-sunum.md.
