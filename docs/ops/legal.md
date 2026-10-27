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

## Release-gate verification — 2026-10-27

**Scope:** PR #94 application head `98973286862ea178925e504adce187f57f7f1d79`, repository evidence and
current official/public vendor documents. No production environment, legal records, customer data,
private provider agreement, tax filing or regulator submission was inspected. No provider was
changed, no filing was submitted and no production operation was performed. Absence of supplied
evidence is **not** proof that the operator has never executed a document or made a filing.

### Technical review

- An independent read-only Opus reviewer completed the TS/JS review of `9d4eaf6..9897328` after
  the designated free TS reviewer was still quota-blocked. No blocking type/async defect was
  reported. This is a code-reading review, not a legal opinion or an additional test run.
- CI [40450060519](https://github.com/eminemrre/cafeduo-main/actions/runs/40450060519) is green
  for this application head, including build/coverage, E2E and real PostgreSQL migration reversal.
- **Open security gate:** the reviewer identified token-bearing diagnostic URLs. The actual
  `lib/errorReporting.ts` `beforeSend` was exercised with a synthetic event: both
  `request.url=/reset-password?token=...` and a navigation breadcrumb `/dogrula?token=...` retained
  the synthetic token. No real token was used and no event was sent to Sentry. Installed SDK
  `HttpContext` obtains the full current URL (`@sentry/browser` `helpers.js`, `getHttpRequestData`).
  Treat this as an important diagnostic-data/credential minimisation issue, not as evidence of
  an observed real-user leak. It predates this PR but remains present. Redact sensitive URL
  parameters in diagnostic request/referrer/breadcrumb fields and test the outgoing event before
  treating this gate as closed. Review backend error/tracing payloads as part of that correction.
- Other review observations are non-blocking: brief cache-hydration banner flicker; a persisted
  acceptance may not update the local cache if the banner unmounts during the request; trailing
  slash routes do not show the banner; checkbox error accessibility; optional endpoint-specific
  limiting (a global API limiter exists); constant-only static escaping/key robustness; and the
  pre-existing register-success/auto-login-failure recovery case. They are not proof of consent
  forgery or a type-check failure. A repeated server acceptance preserves the original time.

### Current-service privacy gates (not only future payments)

1. **Resend — transfer mechanism not established; a specific attempted solution is unavailable.**
   [Resend's security FAQ](https://resend.com/security) explicitly says it does not sign third-party
   or country-specific DPAs/standard contracts, including the Türkiye KVKK Standard Contract,
   and will not append one to its DPA. Do not present "get Resend to sign SS-2" as an available,
   verified close-out route. Its standard GDPR DPA/EU SCC/DPF statements alone do not establish
   a Turkish m.9 transfer basis for this controller. A qualified assessment of an actually
   available alternative mechanism, or an owner-approved change of the processing arrangement,
   is required before this can be marked verified. This is not a conclusion that every possible
   legal transfer mechanism has been ruled out.
2. **Resend — sending region is not storage location.** Its
   [GDPR overview](https://resend.com/security/gdpr) says message content, logs, webhook payloads
   and account records are stored in the **United States**. The
   [region documentation](https://resend.com/docs/dashboard/domains/regions) expressly distinguishes
   Tokyo/Ireland/etc. email dispatch from US storage. Changing the sending region cannot close
   this gate. The vendor states 30-day email/log retention for Free/Pro/Scale and up to 90 days
   for remaining customer data after account termination; the operator's plan and completed
   deletion are not verified by reading that policy.
3. **Other transfers — documentary verification still open.** No evidence was supplied to this
   review establishing the applicable m.9 mechanism for Sentry, Gmail support or map requests,
   including any relevant subprocessors/remote access. Backend Sentry remains conditionally
   enabled with production tracing rate 0.1 (`backend/server.js:41–65`); disabling browser Replay
   is not anonymisation or proof that remaining diagnostics have no personal data.
4. **Offsite backups — include them in the inventory.** `deploy/scripts/backup-production.sh`
   copies a database dump and an environment copy to a configurable rclone remote, defaulting to
   a `b2-cafeduo` target (lines 6, 19–23). Whether this script/remote is used in production, the
   actual provider, location, access rights, encryption and lifecycle rules were not verified.
   Do not assert that this proves active Backblaze processing, or overlook that potential flow.
5. **Retention/deletion — expiry is not erasure.** Verification links expire after 24 hours and
   reset links default to 30 minutes; this does not prove the token rows are purged. The game
   cleanup job deletes unjoined waiting games older than 30 minutes, not all game/history data.
   `logger.js` configures file transports without age-based retention. Docker has size-based
   rotation (`10m` × 3), not a legal time limit. Local backup cleanup does not establish remote
   backup expiry; deployment backups also have no demonstrated lifecycle here. Admin user
   deletion exists, but a fulfilled rights-request process, downstream deletion and backup
   expiry were not demonstrated. Category-specific approved retention and execution evidence
   remain necessary; do not publish an unconditional "all records erased in 30 days" claim.
6. **Disclosure/consent separation — code verified, complete compliance not certified.** The
   [KVKK 2026/347 notice](https://www.kvkk.gov.tr/Icerik/8710/veri-sorumlulari-tarafindan-acik-riza-ve-aydinlatma-metinlerinin-ayri-ayri-duzenlenmesi-gerektigi-hakkinda-kisisel-verileri-koruma-kurulunun-18-02-2026-tarihli-ve-2026-347-sayili-ilke-kararina-iliskin-kamuoyu-duyurusu)
   confirms that information/acknowledgement is distinct from processing consent. The UI and
   acceptance endpoint reflect this separation; correctness of every underlying processing
   basis is a separate assessment. If a Turkish standard contract is actually used, the
   [Authority's signature/notification notice](https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu)
   requires valid signatures and notification within five business days after signatures finish.

### Business/product gates

- **Points/prizes and age:** the
  [Milli Piyango authority](https://www.mpi.gov.tr/lottery) provides permission/appropriate-opinion
  procedures; its online application channel has been `cekilisevi.gov.tr` since 02.02.2026.
  No operator-specific classification, exemption opinion or necessary permission was supplied.
  Neither free entry, "points only", low prize value nor renaming stakes settles classification.
  Relevant age rules must be assessed with the actual mechanics, not imposed or waived here.
- **Paddle acceptance:** its official
  [AUP help page](https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle)
  lists betting-related products, lotteries/contests/sweepstakes/games of chance and virtual
  currency/stored value among restricted categories. CafeDuo's actual café-SaaS/points/reward
  model needs an accurate description and explicit product acceptance, not an assumption from
  the word "SaaS". No account/product approval was demonstrated. This does not itself decide
  whether CafeDuo falls into a prohibited category.
- **Tax/ETBIS/disclosures:** the
  [Ministry's FAQ, questions 10 and 19](https://ticaret.gov.tr/ic-ticaret/sikca-sorulan-sorular/elektronik-ticaret)
  confirms that covered service providers register before relevant activity. Applicability to
  this particular foreign-MoR contract structure, tax/registration/exemption status, KEP and
  any required public identifiers/contact disclosures have not been established by documents.
  This check does not assert that a particular company form is compulsory for every case.
- **VERBIS:** the Authority's
  [current exemption notice](https://www.kvkk.gov.tr/Icerik/8388/KAMUOYU-DUYURUSU) uses employee,
  annual financial balance and main-activity criteria (including the 2025/1572 amendment).
  The operator's facts were not verified; "individual/no employees" alone is not a completed
  exemption assessment. A registration exemption would not remove other KVKK obligations.
- **Checkout/refund:** no Paddle checkout, subscription sync or café approval/trial implementation
  is present in the reviewed backend. Paid-service activation is therefore a separate, unopened
  gate, not something enabled by these legal pages. Paddle's
  [refund policy §7.1](https://www.paddle.com/legal/refund-policy) confirms that submitting a request
  within 14 days does not guarantee discretionary approval; statutory rights remain separate.

**Decision:** independent TS/JS review complete for the named application head; **general legal
release readiness is not verified**. Keep PR #94 in draft and do not merge/deploy or enable payments
based on this review. No legal filing, supplier-contract execution or production migration has
been authorised by requesting this verification.

### Diagnostic-privacy correction (separate branch; not production clearance)

The user subsequently approved technical fixes and an isolated worktree. The correction on
`fix/diagnostic-token-redaction`, based on `feat/legal-pages`, addresses the diagnostic gate above:

- `shared/diagnosticPrivacy.js` strips **all** URL query/fragment values and URL credentials,
  including nested navigation/HTTP breadcrumbs, stack filenames and embedded error-message URLs.
  Raw request bodies, headers, cookies, query strings and sensitive credential fields are omitted.
- `lib/errorReporting.ts` applies it both when collecting breadcrumbs and just before sending
  errors. Error capture stays enabled; browser Replay/tracing/session collection stays disabled.
- `backend/config/errorReporting.js` applies the same scrubber to errors, transactions, individual
  spans and breadcrumbs. Redis instrumentation is disabled because actual blacklist keys contain
  JWTs and rate-limit keys can identify clients. Raw DB statements/query text and DB span command
  descriptions are also omitted as defence in depth. Existing server trace sampling is unchanged.
- Traversal has a 1000-work budget per top-level field/structural collection item and depth limit
  10 (so a large collection cannot erase event type/release metadata), does not invoke object getters,
  summarises Error/Date values and bounds other non-plain objects. Static stack source snippets
  are preserved rather than interpreted as URLs; useful error types, paths and HTTP status remain.
- Regression coverage: `lib/errorReporting.test.ts`, `shared/diagnosticPrivacy.test.js` and
  `backend/config/errorReporting.test.js`. The latter checks real SDK error/transaction envelopes
  using an in-memory transport, including synthetic Redis JWT-bearing statements. All fixture
  secrets are synthetic; no real user payload or production event is needed for verification.

This is **scoped data minimisation**, not a claim to remove arbitrary personal data or secrets
from every free-text message, path, object key or source snippet. Avoid logging sensitive data in
the first place. It does not erase historical events or implement retention/account deletion.
Until reviewed and deployed, production and PR #94 alone retain the earlier behaviour. No
provider switch, migration, legal filing or change to game/age/payment policy is part of this fix.
All other transfer, retention and business gates above remain unresolved.
