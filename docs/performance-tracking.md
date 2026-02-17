# Performance Tracking

Bu doküman Sprint 5 performans doğrulaması için canlı ölçümleri tek yerde toplar.

## API Latency Baseline (Public)

Kaynak: `npm run perf:api-p95`  
Rapor dosyası: `docs/reports/api-p95-latest.md`  
Son ölçüm (UTC): `2026-02-17T13:27:41.625Z`

| Endpoint | Method | Requests | Success % | P50 (ms) | P95 (ms) | P99 (ms) | Avg (ms) | Max (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `/health` | GET | 20 | 100.0 | 35.7 | 317.6 | 1146.2 | 114.1 | 1146.2 |
| `/api/meta/version` | GET | 20 | 100.0 | 34.3 | 86.0 | 144.5 | 51.3 | 144.5 |
| `/api/auth/login` (invalid) | POST | 20 | 100.0 | 69.1 | 182.7 | 332.2 | 86.7 | 332.2 |

Eşikler (script fail koşulu):

- `/health` p95 <= `500ms` (workflow'da `900ms`)
- `/api/meta/version` p95 <= `300ms` (workflow'da `350ms`)
- `/api/auth/login` (invalid) p95 <= `500ms` (workflow'da `600ms`)
- `/api/auth/me` p95 <= `500ms` (workflow'da `700ms`, yalnızca login secret varsa)
- `/api/games` p95 <= `700ms` (workflow'da `900ms`, yalnızca login secret varsa)

## Otomasyon

- Workflow: `.github/workflows/perf-baseline.yml`
- Çalışma sıklığı: her `6` saatte bir + manuel tetikleme.
- Çıktı: GitHub artifact `api-p95-report` (`api-p95-latest.md` + `api-p95-latest.json`).
- Auth probe için kullanılan secret'lar:
  - `SMOKE_LOGIN_EMAIL`
  - `SMOKE_LOGIN_PASSWORD`

## DB EXPLAIN ANALYZE (Deploy Pipeline)

Deploy pipeline artık VPS üzerinde şu scripti çalıştırır:

- `deploy/scripts/db-explain-vps.sh`

Workflow adımı:

- `.github/workflows/deploy-vps.yml` → `Run VPS DB explain probes`

Çıktı formatı:

- `DB_EXPLAIN_METRIC|<probe>|planning_ms=...|execution_ms=...|node=...|rows=...|loops=...`

Bu satırlar GitHub Actions deploy loglarında tutulur ve regressions takibi için kullanılır.

## Hedefler

- Lobi sorguları (`/api/games`) için DB tarafında index destekli plan.
- Kritik sorgularda `Seq Scan` yerine mümkün olduğunda index scan.
- Endpoint bazında P95 trendini haftalık takip etmek.
