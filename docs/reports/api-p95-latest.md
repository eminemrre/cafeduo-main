# API P95 Baseline

- Base URL: `https://cafeduotr.com`
- Requests per endpoint: `20`
- Generated at (UTC): `2026-02-17T14:47:06.252Z`
- Auth probes: `disabled`

| Endpoint | Method | Requests | Success % | P50 (ms) | P95 (ms) | P99 (ms) | Avg (ms) | Max (ms) | Statuses |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `/health` | GET | 20 | 100.0 | 51.5 | 137.2 | 314.9 | 69.5 | 314.9 | 200 |
| `/api/meta/version` | GET | 20 | 100.0 | 58.4 | 73.4 | 85.7 | 57.9 | 85.7 | 200 |
| `/api/auth/login` | POST | 20 | 100.0 | 54.2 | 72.9 | 84.0 | 57.1 | 84.0 | 401 |
