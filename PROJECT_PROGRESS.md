# CafeDuo Project Progress

## Operating Rule
- Read this file before running project commands.
- Keep notes short and current to save context and avoid repeating old investigation.

## Current Goal
- Rebuild CafeDuo UI around the provided pixel/cyber mockups instead of skinning the old layout.
- Current focus: exact landing/nav/hero, auth, create-game, dashboard/forms, and Nişancı Düellosu polish.

## Current State
- Current stabilization pass done locally: homepage/nav fake CP/store/cafe-entry/demo active-table text removed, auth form skew removed, create-game modal uses page-level scrolling, socket connection overlay only appears after a real connected-to-disconnected transition, and Socket.IO now uses production-tolerant reconnect settings.
- Latest validation: targeted UI/socket tests passed (6 suites, 60 tests), full `npm.cmd run test:ci` passed (85 suites, 804 tests), `npm.cmd run build` passed, and Edge/Playwright smoke confirmed no unwanted landing text plus desktop/mobile auth panel fits viewport.
- CI failure fix done locally: npm audit vulnerabilities were resolved with dependency updates/overrides.
- Deploy failure fix done locally: VPS workflow reconciles legacy/empty migration state before strict migration status.
- Deploy port-conflict fix done locally: if port 80 is already owned by Dokploy/another proxy, VPS deploy scales Caddy to 0 and smokes web through a localhost-only port.
- Public smoke false-negative handled locally: public URL smoke is warning-only because VPS-local smoke verifies the deployed commit while Dokploy/proxy routing may return HTML for `/health`.
- `main` includes the MVP/socket/OpenAPI hardening work pushed after `a93917b Harden multiplayer socket rooms`.
- Reference pixel/cyber UI pass is in progress: landing/nav/hero now uses the mockup-style framed navbar, chip rail, left headline, center arcade scene, and right live table panel.
- Auth modal was converted to an opaque pixel/cyber panel so it no longer looks like the old hero with a theme layer.
- Create-game modal was moved to a wide framed pixel/cyber shell and now sits above the navbar.
- Nişancı Düellosu replaced Tank Düellosu locally; legacy tank aliases normalize to the new game type.
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
- Latest validation for the current UI pass: `npm.cmd test -- Hero.test.tsx Navbar.test.tsx AuthModal.test.tsx CreateGameModal.test.tsx --runInBand` passed; `npm.cmd run build` passed with existing font resolution warnings only.

- Deploy attempt `87e605f` reached VPS container deploy, but CI/Playwright/backend startup failed because `backend/server.js` required a misspelled `cafeAdminValidation` module; fixed locally for the next deploy.
- Deploy attempt `44f9869` passed CI/Playwright and reached healthy VPS API, but smoke failed because backend read `APP_VERSION` as `APP_aERSION`; fixed locally for the next deploy.

## Active Constraints
- Do not delete local files without action-time confirmation.
- Keep AGENTS.md rules: no `SELECT *`, add limits to user-facing queries, schema changes via migrations.
- Use `npm.cmd`/`npx.cmd` on Windows.

## Next Steps
- Commit, push, and watch GitHub Actions/Dokploy deploy for the stabilization pass.
- Continue applying the reference pixel/cyber design to dashboard, cafe/admin forms, game lobby, and in-game screens.
- Re-run full `npm.cmd run test:ci`, build, and browser screenshots after the full UI pass.

## Markdown Cleanup
- Keep: AGENTS.md, README.md, DEPLOYMENT.md, SECURITY.md, OPTIMIZATIONS.md, migrations/README.md, backend/handlers/game/README.md, public/assets/games/ATTRIBUTION.md, .github/pull_request_template.md.
- Deleted after user confirmation: .agent/STATE.md, .agent/workflows/*.md, DEVELOPMENT_PLAN.md, ROADMAP.md, tasks/lessons.md, tasks/todo.md, docs/presentation/cafeduo-profesyonel-sunum.md.
