# API P95 Baseline

- Base URL: `https://cafeduotr.com`
- Requests per endpoint: `20`
- Generated at (UTC): `2026-02-17T14:38:31.248Z`
- Auth probes: `disabled`

| Endpoint | Method | Requests | Success % | P50 (ms) | P95 (ms) | P99 (ms) | Avg (ms) | Max (ms) | Statuses |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `/health` | GET | 20 | 100.0 | 53.0 | 187.5 | 271.1 | 77.2 | 271.1 | 200 |
| `/api/meta/version` | GET | 20 | 100.0 | 60.7 | 145.3 | 226.8 | 74.9 | 226.8 | 200 |
| `/api/auth/login` | POST | 20 | 100.0 | 58.7 | 69.6 | 175.5 | 63.8 | 175.5 | 429 |
