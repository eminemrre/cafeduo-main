# 🏛️ Council Decision Log

> Records of the CafeDuo High Council debates.
> Members: VOLT (Speed), AEGIS (Security), MUSE (Quality).

## Template
### [Date] Topic Name
- **🚀 VOLT**: [Innovation proposal]
- **🛡️ AEGIS**: [Risk analysis]
- **🎨 MUSE**: [Quality/UX check]
- **⚖️ VERDICT**: [Final decision approved by Governor]

---

## Decisions

### 2026-02-22 VDS-Only Deployment Policy
- **🚀 VOLT**: Tek hedef ortami tutarak deploy akisini hizlandiralim.
- **🛡️ AEGIS**: Ucuncu taraf staging deploy adimlari kapatilsin; gizli bilgi iceren gecici scriptler kaldirilsin.
- **🎨 MUSE**: Dokumantasyon tek yol (VDS) ile sade kalsin.
- **⚖️ VERDICT**: Approved and applied.
  1. Render/Railway/Netlify staging deploy adimlari CI'dan kaldirildi.
  2. `render.yaml` ve ad-hoc credential scriptleri temizlendi.
  3. Deployment dokumanlari VDS-only akisa gore guncellendi.

### 2026-02-06 Production Deployment Track
- **🚀 VOLT**: Otomatik deploy hatti kurulsun, release hizi dusmesin.
- **🛡️ AEGIS**: Reverse proxy + TLS + trust proxy + CORS explicit origins zorunlu.
- **🎨 MUSE**: Lokalden canliya tek runbook ve environment template ile operasyon sade kalmali.
- **⚖️ VERDICT**: Approved and applied.
  1. `render.yaml` eklendi (Render blueprint).
  2. `deploy/docker-compose.prod.yml` ve `deploy/Caddyfile` eklendi (VPS stack).
  3. `.github/workflows/deploy-vps.yml` eklendi (SSH tabanli otomatik deploy).
  4. `.env` ve Vite base URL/sockets konfigurasyonu production odakli guncellendi.

### 2026-02-05 Fast Game Module Refresh
- **🚀 VOLT**: Keep game loops under 60-90 seconds for fast cafe sessions.
- **🛡️ AEGIS**: Preserve backward compatibility for old game names in active-game rendering.
- **🎨 MUSE**: Replace generic loops with 3 distinct interactions and measurable test coverage.
- **⚖️ VERDICT**: Approved and applied.
  1. New game set: `Refleks Avı`, `Ritim Kopyala`, `Çift Tek Sprint`.
  2. `CreateGameModal` now creates only new game types.
  3. `GameLobby` icon mapping supports both new and old game labels.
  4. Added direct unit tests for all 3 game components.
  5. Global coverage improved to lines `%54.39`; game components each reached `%90+`.

### 2026-02-05 P1 Reliability and Test Hygiene
- **🚀 VOLT**: Keep CI fast by separating Jest unit tests from Playwright e2e scope.
- **🛡️ AEGIS**: Remove dead auth surface (`/auth/verify`) and reduce fallback ambiguity in cafes endpoint.
- **🎨 MUSE**: Fix fragile tests with minimum behavioral coupling to browser internals.
- **⚖️ VERDICT**: Approved and applied.
  1. `jest.config.js` now ignores `<rootDir>/e2e/`.
  2. `components/Dashboard.test.tsx` leaderboard mock aligned with component API.
  3. `components/OfflineFallback.test.tsx` stabilized for jsdom navigation limitations.
  4. `hooks/useRewards.test.ts` aligned with new `api.shop.buy(rewardId)` contract.
  5. Removed `/api/auth/verify` route and dead controller stub.
  6. `getAllCafes` now uses DB-first query and fallback only on DB error.

### 2026-02-05 P0 Security Hardening
- **🚀 VOLT**: Keep momentum by applying route-level guards first, then refactor.
- **🛡️ AEGIS**: Eliminate insecure defaults and client-trusted purchase payloads.
- **🎨 MUSE**: Keep behavior stable for users while tightening backend controls.
- **⚖️ VERDICT**: Approved and applied.
  1. `JWT_SECRET` fallback removed; startup fails fast without secret.
  2. `POST /api/rewards` and `DELETE /api/rewards/:id` locked behind auth + cafe-admin role.
  3. Duplicate rewards endpoint block removed to avoid route shadowing.
  4. `POST /api/coupons/use` locked behind auth + cafe-admin role.
  5. `/api/shop/buy` now validates reward from DB and no longer trusts client cost/title.
  6. Frontend buy contract updated to send only `rewardId`.

### 2026-02-05 Redis Strategy
- **🚀 VOLT**: Use `redis:alpine` in docker-compose. Fast, simple.
- **🛡️ AEGIS**: Must use environment variables for connection strings. Security first.
- **🎨 MUSE**: Ensure Frontend handles reconnection gracefully (Toast notifications).
- **⚖️ VERDICT**: **Plan B** (Docker + Env + UX Check) was approved.
