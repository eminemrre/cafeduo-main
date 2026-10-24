# Server-authoritative games (protocol v2)

> **Live since 2026-10-22** (release #85, `f16e174`, owner-approved). Production
> runs `GAME_ENGINE_V2_ENABLED=true`. Aim playability and fresh-install
> migrations were fixed before release; the one known limit left is
> cross-instance queue ordering (see
> [game-authority-review.md](game-authority-review.md)); production runs a single
> API container.

CafeDuo's ranked **Bilgi Yarışı**, **Nişancı Düellosu** and **Amiral Battı**
matches are run by the server. The client renders public snapshots and sends
actions; it never sends a score, a hit, a winner, a fleet, a clock value or a
settlement flag.

## Trust boundary

- `games.game_state` is the public engine view. It is produced only through
  `backend/gameEngine/gameView.js`, which allowlists keys.
- `games.game_private_state` holds answer keys, future questions, trajectory
  seeds, joker choices, per-action receipts and shots. It is never selected for
  an API/socket/list/history response.
  An authenticated action/GET may project only the requesting player's current
  joker choices into the separate allowlisted `actorView.joker`; common
  `gameState` and sockets never contain `hiddenOptions`.
- Write paths for legacy `liveSubmission`, `scoreSubmission`, `move` and
  `finish({ winner })` answer `410 LEGACY_PROTOCOL_DISABLED`.
- `game_move` and `update_game_state` sockets are rejected. Socket events only
  announce a revision; clients refetch the snapshot.
- Creating or joining a quiz/aim/battleship match while the flag is off answers
  `503 GAME_ENGINE_MAINTENANCE`.

## Action protocol

`POST /api/games/:id/actions` (authenticated HTTP only):

```json
{ "actionId": "unique_8_64", "roundId": "r1", "type": "answer", "optionIndex": 2 }
```

The client timestamp, `score`, `winner`, `done`, `results`, `resolvedWinner`
and `settlementApplied` fields are ignored if sent. A client-generated ID and
the current round are the only replay controls:

- same `actionId` + same payload → stored receipt, `duplicate: true`
- same `actionId` + changed payload → `409 ACTION_ID_CONFLICT`
- old/future round → `409 STALE_ROUND`
- second answer in one round → `409 ALREADY_ANSWERED`
- second joker in a match → `409 JOKER_USED`
- DB row lock (`SELECT ... FOR UPDATE`) for DB games, per-game promise queue for
  memory games.

Quiz: 10 rounds × 15 s, 900 ms reveal, early close when both players answer.
Correct answer = 10 + remaining full seconds; streak bonus from the third
correct answer in a row; final question ×2; cap 320. A tie is `draw: true` and
`winner: null`.

Aim: 5 rounds × 8 s + 750 ms reveal. One shared server-seeded trajectory with a
seeded rhythm; distance ≤ 2.5 → 3, ≤ 6 → 2, ≤ 12 → 1, otherwise 0. Cap 15. The
former mobile 7/32 speed is not used in a ranked match.

Lag compensation (approved 2026-10-22): `fire` may carry `shotAt`, the
client's server-clock estimate of the reticle frame on screen. The server
scores `clamp(shotAt, max(receivedAt − 250 ms, round start), receivedAt)`;
without `shotAt` it scores the receive time. The round deadline, "both fired"
closing and ordering still use the receive time, and `shotAt` is part of the
action fingerprint. A forged value can only pick a moment from the last 250 ms,
which the public trajectory already allows a scripted client to time.

Amiral Battı (`backend/gameEngine/battleshipEngine.js`, rules in
`shared/battleship.js`): 8×8 seas, fleet 4+3+3+2, 45 s placement, then
alternating 20 s turns with no extra shot on a hit. A missed turn passes; three
missed turns in a row forfeit. The first to sink the whole fleet wins; at the
128-turn cap (64 cells per player) more hits wins and equal is a draw.
Actions: `place {layout}` (four `{cell, dir}` in fleet order) or
`place {auto: true}` (the server's seeded layout), then `fire {cell}` (0–63);
turn ids run `r1`..`r999`. An unfinished placement is auto-placed from the
seeded layout at the deadline; if nobody placed, the match is `abandoned`.
Fleets, seeded layouts and the first turn stay in `game_private_state`; the
public state holds only shots, sunk ship shapes and whose turn it is. When the
match ends, the engine copies the placed fleets into `reveal` (a side that never
placed reveals nothing) and `gameView` publishes it only for a finished match, so
both players see the ships that got away. A
player's own fleet is projected as `actorView.fleet` by the authenticated
action/GET only, never by sockets, lobby, join, active-game or history. The
practice match against the bot is local and unranked.

## Settlement

Settlement happens only in `backend/gameEngine/settlement.js` and at most once:

- The engine result is authoritative; `/finish` can only query/finalize it.
- Competitive `/resign` answers `USE_ENGINE_ACTION`; resignation goes through
  the action endpoint with `type: "resign"`.
- The game row is locked and the result gets `settled`, `settledAt` and
  `stakeTransferred`. `applyDbSettlement`/`applyMemorySettlement` runs in the
  same transaction.
- If neither player produced an accepted action, the result is
  `cancelled: true`, `reason: "abandoned"`, and balances/`games_played` are not
  touched.
- Active unpaid competitive games cannot be deleted.

## Client and reconnect

`useLiveScoreGame` sends actions and applies allowlisted snapshots. The client
ignores older revisions and re-applies an equal revision so a settlement flag is
not lost. A socket gap, reconnect or refresh triggers a snapshot fetch; the
fallback poll is at least 15 s. A legacy active row without a v2 engine is
reported as `CLIENT_UPDATE_REQUIRED`; there is no legacy fallback.

## Rollout runbook (requires approval)

**Do not run these steps automatically. Ask the owner for each gate.**

> **Run on 2026-10-22 (owner-approved).** A one-off GitHub Actions job on the
> production environment (branch deleted afterwards) backed up the database
> and `.env`, added `games.game_private_state` with its `pgmigrations` row,
> and set `GAME_ENGINE_V2_ENABLED=true` in `/opt/cafeduo-main/.env`. There were
> 0 legacy active/waiting ranked games, so no retirement was needed. Merging
> #85 then deployed through Deploy VPS, whose `migrate:status` gate passed.
> Production deploys with `deploy/docker-compose.prod.yml`, which must pass the
> flag (`deploymentContract.test.js`).

1. **Preflight**
   - Confirm CI is green for the whole chain and the backend + frontend are
     deployed together.
   - Apply the migrations first (`npm run migrate:status`, then `npm run
migrate:up`); the transition helper needs `games.game_private_state`.
   - Confirm `GAME_ENGINE_V2_ENABLED=false` and take a database backup.
   - Record `/api/health`, `/api/readiness` and Sentry state.
2. **Freeze new ranked games**
   - Keep the flag off while old active/waiting games are announced and drained.
   - Do not copy old client scores into v2. Finished history and already
     transferred points are not modified.
3. **Dry-run old-game retirement**

   ```bash
   DATABASE_URL=postgresql://... npm run game-engine:transition
   ```

   Review every listed id/type/status/table/stake. The command writes nothing.
   Expected result for a clean rollout is `legacy_active_or_waiting=0`.

4. **Retire legacy rows (separate approval)**

   ```bash
   DATABASE_URL=postgresql://... \
   GAME_ENGINE_V2_TRANSITION_APPROVED=1 \
   npm run game-engine:transition -- --apply --confirm-cancel-legacy
   ```

   This only matches active/waiting ranked rows whose private state is not v2.
   It sets `status=finished`, `winner=null`, and a canceled
   `legacy_protocol_retired` result. It does **not** touch balances,
   `games_played`, wins or finished history. Re-running is safe; the batch is
   capped at 100 rows.

5. **Activate**
   - Set `GAME_ENGINE_V2_ENABLED=true` in the deployment environment and
     restart the backend.
   - Verify `/api/health`, `/api/readiness`, login/check-in, one 0-stake quiz
     and one 0-stake aim match with owner-approved test accounts, then Sentry.
   - Do not use other players' games or points.
6. **Rollback**
   - Set the flag to `false`; new/join attempts close again. Do not enable a
     legacy score path. Active v2 games keep their server state and can settle
     through the engine/job; investigate before deleting anything.

## Legacy question-bank disclosure

The 396-question bank was previously shipped in an older client bundle
(`lib/quizQuestionBank.ts`). Removing that module now prevents **new** bundle
leakage, but it does not make the historical questions secret again. The server
bank lives in `backend/gameEngine/data/quizQuestions.json`; a build must contain
none of its question text. Bot practice uses a small separate set and never
imports the ranked bank.

## Verification commands

```bash
npm run quality
npm test
npm run build
npm audit --audit-level=moderate
npm run test:e2e:smoke                 # Chromium smoke, flag off
npm run test:e2e:v2                    # two-context v2 flow (flag on)
TEST_DATABASE_URL=postgresql://... npx jest backend/gameEngine/settlement.postgres.test.js --runInBand
```

The v2 E2E covers two browser contexts, 10 quiz rounds, 5 aim rounds, joker,
mid-round refresh, offline reconnect, WebGL-disabled rendering, 50/150/300 ms
client delay, an old cached-client refresh path, forged fields/replay conflicts,
timeout and resignation. The real
PostgreSQL test covers concurrent finalizers, two games for the same users, and
abandoned-match cancellation.

## Honest limits

- An automation that sees the trajectory can still fire at the right moment.
  Forged shots and client scores are rejected, but perfect automation is not
  prevented.
- Live production validation has **not** been performed, and the flag remains
  off until the owner approves it.
- Old ranked rows are not canceled automatically by the app; the script above
  is the only retirement path and needs explicit approval.
