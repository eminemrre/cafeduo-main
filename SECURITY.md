# CafeDuo Security Notes

## Supported Version

| Version | Status |
| --- | --- |
| 1.x | Supported MVP |

## Production Security Baseline

Required:

- `JWT_SECRET` must be 64+ random bytes.
- `BLACKLIST_FAIL_MODE=closed`.
- `RATE_LIMIT_STORE=redis`.
- `RATE_LIMIT_PASS_ON_STORE_ERROR=false`.
- Do not commit `.env`, database dumps, tokens, cookies, or private keys.
- Keep `BOOTSTRAP_ADMIN_PASSWORD` only in Dokploy/host secrets.
- Keep `COOKIE_DOMAIN` empty for same-origin deployment.
- Include the production origin in `CORS_ORIGIN`.

Recommended:

- Use HTTPS only.
- Keep Redis private to the app network.
- Keep PostgreSQL private to the app network.
- Rotate bootstrap admin password after first production verification.
- Monitor `/readiness`, backend logs, failed auth spikes, and rate-limit errors.

## Authentication

- JWTs are validated on HTTP and Socket.IO paths.
- Socket.IO checks token revocation before accepting connections.
- Logout/token blacklist should fail closed in production.
- Bootstrap admin emails are promoted on startup/login/register.

## Multiplayer Integrity

- Game room joins are checked against the game host/guest or admin role.
- Move broadcasts require the socket to already be in the game room.
- State broadcasts reject oversized or unserializable payloads.
- Final game settlement is handled server-side.

## Database Safety

- Schema changes must be migrations.
- Production queries must use explicit columns.
- User-facing lists must have limits.
- Avoid N+1 query patterns in request paths.

## Reporting a Vulnerability

Do not open public issues for security reports.

Send the report privately to the maintainer with:

- affected endpoint or flow
- reproduction steps
- expected impact
- logs/screenshots if available without exposing secrets

## Local Secret Hygiene

Before committing:

```powershell
git status --short
git diff --cached
```

Confirm no real `.env` files, passwords, private keys, or production tokens are staged.
