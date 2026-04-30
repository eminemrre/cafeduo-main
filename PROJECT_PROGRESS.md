# CafeDuo Project Progress

## Operating Rule
- Read this file before running project commands.
- Keep notes short and current to save context and avoid repeating old investigation.

## Current Goal
- Keep GitHub checks green and continue post-MVP polish from a stable baseline.
- Current live bugfix focus: admin cafe save button, game socket reconnect overlay, and game-end point settlement confidence.

## Current State
- CI failure fix done locally: npm audit vulnerabilities were resolved with dependency updates/overrides.
- Deploy failure fix done locally: VPS workflow reconciles legacy/empty migration state before strict migration status.
- Deploy port-conflict fix done locally: if port 80 is already owned by Dokploy/another proxy, VPS deploy scales Caddy to 0 and smokes web through a localhost-only port.
- Public smoke false-negative handled locally: public URL smoke is warning-only because VPS-local smoke verifies the deployed commit while Dokploy/proxy routing may return HTML for `/health`.
- `main` includes the MVP/socket/OpenAPI hardening work pushed after `a93917b Harden multiplayer socket rooms`.
- XPatla-inspired dark/red UI is applied.
- Cafe creation/admin assignment fixes were implemented with migration `20260429123000_align_cafe_schema_columns.js`.
- Socket MVP fix done: game rooms require participant/admin access before join and require room membership before move/state broadcasts.
- OpenAPI duplicate `/api/games/{id}` path fixed; duplicate Swagger registration removed.
- Confirmed markdown cleanup done: removed stale agent notes, roadmap/development plan, task notes, and old presentation note.
- Docs refresh done: README, DEPLOYMENT, SECURITY, and OPTIMIZATIONS describe the current MVP/Dokploy state.
- Deploy hardening done: compose defaults fail closed for Redis/rate-limit auth behavior and pass bootstrap admin/build metadata envs explicitly.
- MVP baseline is complete locally: user auth/check-in, cafe/admin flows, two-player games, rewards, build, and E2E gates pass.
- Admin cafe save bug fixed locally: edit form now defines and parses primary location before calling `api.admin.updateCafe`.
- Local Socket.IO auth/origin bug fixed locally: browser fallback now uses same-origin socket URL and Vite proxies `/socket.io` with websocket support to backend.
- Connection overlay hardened locally: delayed reconnect timer is cleared on reconnect/unmount so stale timers cannot force a false "Bağlantı Kesildi" state.
- Local DB was unreachable during the last migration status check, so migration up/down could not be verified locally.
- Latest validation: targeted admin/socket tests (49 tests), game settlement/multiplayer tests (47 tests), `npm.cmd run test:ci` (814 tests), `npm.cmd run build`, and browser smoke at `http://127.0.0.1:3002/` passed; build has existing font resolution warnings only.

## Active Constraints
- Do not delete local files without action-time confirmation.
- Keep AGENTS.md rules: no `SELECT *`, add limits to user-facing queries, schema changes via migrations.
- Use `npm.cmd`/`npx.cmd` on Windows.

## Next Steps
- Push the latest admin/socket/game bugfix when ready and verify GitHub/Dokploy checks.

## Markdown Cleanup
- Keep: AGENTS.md, README.md, DEPLOYMENT.md, SECURITY.md, OPTIMIZATIONS.md, migrations/README.md, backend/handlers/game/README.md, public/assets/games/ATTRIBUTION.md, .github/pull_request_template.md.
- Deleted after user confirmation: .agent/STATE.md, .agent/workflows/*.md, DEVELOPMENT_PLAN.md, ROADMAP.md, tasks/lessons.md, tasks/todo.md, docs/presentation/cafeduo-profesyonel-sunum.md.
