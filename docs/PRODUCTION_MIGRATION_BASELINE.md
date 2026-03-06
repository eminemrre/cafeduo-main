# Production Migration Baseline Runbook

## Why this exists

CafeDuo production was historically bootstrapped via `schema.sql` / `backend/server.js:initDb`, not via `node-pg-migrate`.
That means a production database can be healthy while `public.pgmigrations` is missing.

As of Sprint 2, deploy is intentionally fail-fast:
- production env must validate
- authenticated public smoke must run
- migration status must be clean before rollout

If `Deploy VPS` fails at migration status with:
- `table "public.pgmigrations" not found`
- or `pending migrations detected in strict mode`

use this runbook.

## Critical constraints

- Do not run `npm run migrate:up` blindly on a legacy production database.
- Do not manually insert rows into `pgmigrations` without verification.
- Do not edit production `.env` on VPS and assume it is permanent; `DEPLOY_ENV_B64` is the source of truth.

## Current legacy situation

Legacy migration set:
- `20240224000001_initial_schema`
- `20240224000002_add_performance_indexes`

Important nuance:
- `20240224000002_add_performance_indexes.js` references `password_reset_tokens.token`
- the real runtime schema uses `password_reset_tokens.token_hash`
- because of that, baselineing only `20240224000001` is not enough
- the repo now includes a replacement migration:
  - `20260306190000_normalize_legacy_performance_indexes.js`

The intended safe sequence is:
1. verify the legacy schema really matches the pre-migration bootstrap shape
2. baseline `20240224000001` and `20240224000002`
3. run `npm run migrate:up`
4. let `20260306190000_normalize_legacy_performance_indexes.js` backfill the missing valid indexes

## Commands

Preferred path: run from the production repo checkout on VPS through the Docker Compose API runtime.

GitHub Actions alternative:

```bash
# Report only
gh workflow run "Migration Baseline" --ref <branch-with-tooling> -f mode=report

# One-time apply after reviewing the report
gh workflow run "Migration Baseline" --ref <branch-with-tooling> -f mode=apply -f confirm_apply=APPLY
```

This path is useful before merging to `main`, because it avoids re-triggering the strict deploy job
until the legacy baseline is actually in place.

```bash
cd /opt/cafeduo-main

# 1. Pull the repo version that contains the baseline tool + replacement migration
git pull origin main

# 2. Ensure .env already matches DEPLOY_ENV_B64

# 3. Report-only verification
bash deploy/scripts/migration-baseline-vps.sh report

# 4. One-time apply after reviewing the report
bash deploy/scripts/migration-baseline-vps.sh apply
```

Host-shell fallback exists, but the compose wrapper is preferred because it uses the same
network/env topology as the production `api` service.

## What `migrate:baseline:report` verifies

It checks:
- required legacy tables exist
- required legacy columns exist
- required initial indexes exist
- the replacement migration file is present
- `pgmigrations` current state

It exits non-zero if the initial schema fingerprint is incomplete.

## What `migrate:baseline:apply` does

It will only proceed when:
- the initial legacy schema fingerprint is verified
- `--include-superseded-performance` is explicitly passed
- replacement migration `20260306190000_normalize_legacy_performance_indexes` exists in the repo

Then it creates `public.pgmigrations` if missing and inserts:
- `20240224000001_initial_schema`
- `20240224000002_add_performance_indexes`

This is intentional. `20240224000002` is treated as a legacy-superseded migration; the replacement migration carries the missing valid index work.

## Expected post-baseline state

After step 4:
- `npm run migrate:status` should show `20260306190000_normalize_legacy_performance_indexes.js` as pending

After step 6:
- `npm run migrate:status` should show no pending migrations
- `Deploy VPS` can pass the migration gate

## If baseline report fails

Do not continue with baseline apply.

Instead:
1. inspect missing tables/columns/indexes from the report
2. compare production schema with:
   - `schema.sql`
   - `backend/server.js:initDb`
   - `migrations/20240224000001_initial_schema.js`
3. decide whether the production database needs:
   - a manual schema repair
   - a dedicated one-off corrective migration
   - or a revised baseline fingerprint

## If `migrate:up` fails after baseline

Do not rerun blindly.

Capture:
- failing migration name
- exact SQL error
- `npm run migrate:status`

Then fix forward with a new migration. Do not edit production data ad hoc unless the fix plan is explicit and reviewed.
