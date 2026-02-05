# System Heartbeat

> **Status:** 🟢 Stable (P0 + P1 Completed)

## Vital Signs
- **Backend Security**: JWT fallback secret removed; `JWT_SECRET` is now required at startup.
- **AuthZ Hardening**: `POST /api/rewards`, `DELETE /api/rewards/:id`, `POST /api/coupons/use` now require authenticated cafe-admin privileges.
- **Data Integrity**: `/api/shop/buy` now uses DB-validated reward price/title instead of client-submitted values.
- **API Contract**: Frontend buy flow updated to send only `rewardId`.
- **Build**: `npm run build` passed on 2026-02-05.
- **Tests**: `npm run test:ci` passed on 2026-02-05 (unit suite separated from e2e).
- **Auth API**: Deprecated `/api/auth/verify` route removed from router (dead 501 path removed).
- **Cafe API**: `getAllCafes` now attempts DB query first and only falls back on DB error.

## Next Checkup
- P1 done; next target is P2 observability and endpoint modularization.
