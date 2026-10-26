# E-mail (Resend)

CafeDuo sends transactional e-mail only: verification, welcome and password
reset (more templates come with café sign-up and billing). One path,
`sendEmail` in `backend/services/emailService.js`: Resend first, SMTP as a
fallback, otherwise nothing is sent and only the template and a masked address
are logged (never a link or token).

## Production

- **Key:** GitHub secret `RESEND_API_KEY` (a Resend *sending access* key limited
  to `cafeduotr.com`). Deploy VPS checks it, writes it to
  `/opt/cafeduo-secrets/app.env`, and `deploy-production.sh` merges that file
  into the release `.env` (deploy-managed keys win over the server `.env`).
  A missing secret stops the deploy.
- **Readiness:** `/api/readiness` reports `checks.email`; the deploy
  verification requires `true`.
- **Domain (DNS at turkticaret.net):** Resend's DKIM (`resend._domainkey`), the
  `send` subdomain MX and SPF from the Resend dashboard, a single root SPF record
  (two `v=spf1` records invalidate both), and `_dmarc` starting at `p=none`.
  Resend must show the domain as *verified*.
- **Sender:** `RESEND_FROM`, default `CafeDuo <noreply@cafeduotr.com>`.

## Verification links

`/dogrula?token=…`, 24 hours, single use, stored as sha256. A newer link
supersedes older ones. Verification never blocks a player; the panel shows a
band with a resend button (3 per user per hour).

## Tests

`EMAIL_CAPTURE=true` (set by `scripts/e2e/run-with-env.cjs`, refused when
`NODE_ENV=production`) keeps e-mails in memory behind `GET /api/test/emails?to=`;
`e2e/email-verification.spec.ts` reads the links from there.
