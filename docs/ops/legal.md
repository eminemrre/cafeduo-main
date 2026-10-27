# Legal content and acceptance operations

These controls support compliance work; they are not a legal opinion or a certification.
The operator is Emin Emre. The public contact details were supplied by the operator.
Do not infer corporate, tax, registration or supplier-contract details from the site name.

## Publishing contract

- Public content: `lib/legal/documents.ts`; identity and revision: `lib/legal/seller.ts`.
- Server acceptance version: `backend/config/legal.js`. `lib/legal/version.test.ts` prevents drift.
- React and the built no-JavaScript pages consume the same document content.
- Change `LEGAL_VERSION` and the fixed update label only for a reviewed publication. Keep the
  published revision in Git; never rewrite historical acceptance evidence as a newer revision.
- Registration requires the literal boolean `acceptTerms: true` and the version displayed to
  the user. An old/PWA client gets `TERMS_REQUIRED` or `TERMS_VERSION_CHANGED`, not fabricated consent.
- `POST /api/auth/accept-terms` is authenticated and subject to the existing global CSRF middleware.
  It uses the session identity, never a submitted user ID or client timestamp. Retrying the same
  revision retains its first acceptance time. Existing users start with null evidence, not a backfill.
- Acceptance is of the usage terms. The KVKK notice is separate information, not blanket consent
  for processing, international transfers, advertising or marketing.
- Cookie-banner dismissal is a browser-only acknowledgement. It is not terms acceptance and it
  never gates login, password reset or registration.
- `lib/errorReporting.ts` keeps browser error reporting, but removes Replay, BrowserTracing and
  BrowserSession integrations and sets both replay sample rates and the tracing rate to zero.
  Even error-triggered replay is disabled (a zero session rate alone would not do this).
  Default error handlers/breadcrumbs remain for error diagnosis; backend APM remains technical
  error/performance monitoring. None of this proves absence of personal data or a valid m.9
  transfer basis. Do not re-enable session recording or behavioural analytics under the
  necessary-cookie notice; it needs a separate product/legal/consent decision first.

## Release blockers outside the text/code

Do not label this branch "legally compliant" or enable paid checkout based only on passing tests.
Before publishing/releasing, obtain the following evidence or an appropriately qualified review:

1. **International transfers (current service, not only a future payment concern).** Inventory
   actual recipients, purposes, data, contracting entities, hosting, subprocessors and remote
   access. Include Resend, Sentry, the Google/Gmail support inbox and OpenStreetMap map requests;
   include Paddle when integrated. An IP geolocation result does not prove data location. EU
   hosting, a vendor's GDPR DPA, token hashing and removing `Sentry.setUser` do not by themselves
   establish KVKK m.9 compliance or anonymise logs. Record the actual applicable transfer basis
   and safeguards; if relying on a Turkish standard contract, obtain valid signatures and notify
   the Authority within five business days after signatures are completed. Do not use routine
   operation as an "occasional transfer" exception or bundle transfer consent into signup.
   If a valid basis cannot be established, a provider/data-flow change needs the owner's decision.
2. **Tax and service-provider disclosures.** Have a Turkish accountant assess the actual income
   and applicable registration/exemption, invoices and tax duties. Paddle being Merchant of Record
   is not an exemption for the operator's income. Confirm ETBIS scope for the actual MoR/SaaS model,
   KEP/contact phone and any required tax/trade/chamber disclosures. Do not invent identifiers or
   publicly post a personal identification number as a substitute without a legal basis.
3. **Games and prizes.** Obtain a Turkish lawyer's/competent authority's assessment of the actual
   player-to-player point transfer, random daily rewards and real café rewards. Do not classify
   the product as lawful merely because entry is free, points are not sold, or a prize has low
   value. Renaming a stake or awarding points instead of coffee does not resolve the substance.
   Give Paddle a complete, accurate description and obtain product acceptance; never conceal
   mechanics to pass review. Mechanics and age rules require an explicit product decision.
4. **Retention and rights fulfilment.** Confirm actual category-specific retention and deletion
   procedures, backup expiry and supplier deletion. Do not claim automatic or unconditional
   30-day erasure. Verify any VERBIS exemption against the operator's actual facts/current decision;
   exemption from registration is not exemption from other KVKK obligations.
5. **Paid-service activation.** Review the final B2B offer, tax-inclusive checkout total, trial,
   renewal, cancellation, withdrawal and discretionary-refund terms against the actual checkout.
   Public pages currently say paid online subscriptions are not active. Remove that statement
   and publish a reviewed revision before enabling payment. A request within 14 days is not a
   universal refund guarantee. Statutory rights must not be excluded on initial or renewal charges.

No production migration, deployment, provider replacement, gambling/lottery registration, tax
registration or legal filing is performed by implementing these pages.

## Data-subject requests

1. Monitor `cafeduotr@gmail.com` and written submissions to the published address. Log receipt date,
   request type, verified account reference, handler, deadline and outcome in a private access-controlled
   register (not the public repository, issue tracker or analytics).
2. Verify identity proportionately using the registered contact or another lawful method. Never
   request passwords, authentication tokens or full payment card details. Follow the application
   Tebliğ for mandatory information and written/electronic submission requirements.
3. Identify the applicable records across the app, logs, backups and processors. Evaluate lawful
   retention exceptions and third-party rights; do not delete evidence indiscriminately.
4. Respond as soon as possible and no later than 30 days. Explain any partial refusal, legal basis,
   relevant complaint rights and permitted fees. Check that electronic answers comply with the
   required form; an informal support acknowledgement is not necessarily the substantive answer.
5. Execute approved corrections/deletions through a verified operational procedure; record what
   was done, what remains and why, any backup limitation and required recipient notifications.

## Personal-data incidents

1. Contain the incident and preserve only necessary evidence; restrict access and do not paste
   affected user data, secrets or tokens into public tickets or external AI tools.
2. Record when the controller learned of it; identify affected data/people, recipients, exposure,
   containment and the notification decision with the responsible professional.
3. Where the notification duty applies, notify the Authority without delay and no later than
   72 hours after awareness under Decision 2019/10; explain any delay. Notify affected people as
   soon as reasonably possible once identified. Do not wait for a complete root-cause report;
   supplement the information as it becomes available.
4. Keep the assessment, notifications, remedial actions and recipient follow-up privately.

## Migration and rollback

`20261027150000_terms_acceptance` adds two nullable fields. Apply the committed node-pg-migrate
migration only with explicit production approval, a verified backup and a bounded lock wait,
before merging application code that reads those columns. Do not use hand-written production SQL
or manually add `pgmigrations` entries instead of running the migration.

Even nullable/default-free `ADD COLUMN` takes an `ACCESS EXCLUSIVE` lock. The authorized
production migration process must receive `PGOPTIONS='-c lock_timeout=5s'` so a busy `users`
table causes a bounded failure instead of an unbounded queue of authentication requests.
Pass this environment variable into the actual migration container/process, not merely the
SSH host shell. The existing production approval/baseline guards still apply. If the lock
times out, stop and investigate long-running transactions; do not remove the bound or merge
the application before verifying that the migration actually completed.

CI's `fresh-db-migrations` job verifies the complete up → down → up chain on disposable PostgreSQL.
If no local PostgreSQL is available, say so; mocked queries do not verify real database behavior.
On a production application rollback, retain the new columns and acceptance receipts. `down` is
for disposable development/CI databases, not destruction of production legal evidence.

## Authoritative reference points (checked 2026-10-27)

- [KVKK disclosure obligation](https://www.kvkk.gov.tr/Icerik/2033/Aydinlatma-Yukumlulugu-)
- [Decision 2026/347: disclosure and consent must be separate](https://www.kvkk.gov.tr/Icerik/8710/veri-sorumlulari-tarafindan-acik-riza-ve-aydinlatma-metinlerinin-ayri-ayri-duzenlenmesi-gerektigi-hakkinda-kisisel-verileri-koruma-kurulunun-18-02-2026-tarihli-ve-2026-347-sayili-ilke-kararina-iliskin-kamuoyu-duyurusu)
- [KVKK international-transfer guidance](https://www.kvkk.gov.tr/Icerik/8142/Kisisel-Verilerin-Yurt-Disina-Aktarilmasi-Rehberi)
- [Standard-contract signature and notification notice](https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu)
- [KVKK data-subject rights](https://www.kvkk.gov.tr/Icerik/2036/Ilgili-Kisinin-Haklari)
- [KVKK application-response duty](https://www.kvkk.gov.tr/Icerik/2046/Ilgili-Kisiler-Tarafindan-Yapilan-Basvurularin-Cevaplanmasi-Yukumlulugu)
- [KVKK breach-notification portal](https://www.kvkk.gov.tr/Icerik/5362/Veri-Ihlali-Bildirimi)
- [Ministry of Trade e-commerce FAQs](https://ticaret.gov.tr/ic-ticaret/sikca-sorulan-sorular/elektronik-ticaret)
- [Paddle Buyer Terms, particularly §§3, 6, 15](https://www.paddle.com/legal/buyer-terms)
- [Paddle Refund Policy, particularly §7.1](https://www.paddle.com/legal/refund-policy)

Risk scores, fee/fine amounts, trademark estimates and statutory thresholds in earlier research
are preliminary, not verified conclusions for this operator. Do not copy them into public terms.
