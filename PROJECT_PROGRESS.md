# CafeDuo Project Progress

## Operating Rule
- Read this file before running project commands.
- Keep notes short and current to save context and avoid repeating old investigation.

## Current Goal
- Remove unnecessary markdown notes after review and explicit deletion confirmation.
- Finish MVP readiness: stable two-player games, reliable cafe/admin flows, deployable production state.

## Current State
- `main` includes the MVP/socket/OpenAPI hardening work pushed after `a93917b Harden multiplayer socket rooms`.
- XPatla-inspired dark/red UI is applied.
- Cafe creation/admin assignment fixes were implemented with migration `20260429123000_align_cafe_schema_columns.js`.
- Socket MVP fix done: game rooms require participant/admin access before join and require room membership before move/state broadcasts.
- OpenAPI duplicate `/api/games/{id}` path fixed; duplicate Swagger registration removed.
- Local DB was unreachable during the last migration status check, so migration up/down could not be verified locally.
- Latest validation: `node --check backend/server.js`, OpenAPI YAML parse, targeted Jest, `test:ci` (812 tests), `build`, and `test:e2e` (14 tests) passed.

## Active Constraints
- Do not delete local files without action-time confirmation.
- Keep AGENTS.md rules: no `SELECT *`, add limits to user-facing queries, schema changes via migrations.
- Use `npm.cmd`/`npx.cmd` on Windows.

## Next Steps
- Confirm markdown deletion list before removing any files.
- Continue MVP polish from this file before running project commands.

## Markdown Cleanup Candidates
- Keep: AGENTS.md, README.md, DEPLOYMENT.md, SECURITY.md, OPTIMIZATIONS.md, migrations/README.md, backend/handlers/game/README.md, public/assets/games/ATTRIBUTION.md, .github/pull_request_template.md.
- Delete after explicit confirmation: .agent/STATE.md, .agent/workflows/*.md, DEVELOPMENT_PLAN.md, ROADMAP.md, tasks/lessons.md, tasks/todo.md, docs/presentation/cafeduo-profesyonel-sunum.md.
