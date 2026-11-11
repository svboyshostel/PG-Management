# PG Manager — Phase 4 audit and readiness report

**Review date:** 4 November 2026. **Status: safe hardening implemented; Phase 4 is not fully signed off and the app is not yet production-certified.**

No existing financial records were deleted, reset, or edited for testing. No database migration was applied to the existing Neon database, no demo was deployed, no WhatsApp message was sent, no scheduler was connected, and nothing was published or pushed to GitHub. All database mutation tests ran in isolated in-memory PostgreSQL fixtures.

## 1. Audit summary

The existing app already provides branches/rooms/beds, resident onboarding/editing/transfers, bills/charges/discounts, deposits, payments/FIFO/reversals, checkout/refund recording, dashboards/payment CSV exports, centralized WhatsApp templates, manual queues, optional Meta API queues, consent, and merged resident message history. This work retained the existing architecture and design.

Automated isolated tests verify actual application SQL and handlers for principal workflows, not just pure helper functions. However, current application restrictions and tests do **not** establish all concurrency, live hosting, backup, performance, or signed-in browser acceptance criteria.

## 2. Findings by severity

### Critical

No critical exploit was established by this review. This is not a guarantee of absence.

### High — addressed in source and tested where noted

- **Unrestricted staff branch data and mutations:** Added explicit assignments, SQL scopes, and entity-derived authorization to resident, room/bed, payment, charge, reversal, checkout, refund, dashboard and messaging functions. Owner remains unrestricted; no assignments grants no access. Cross-branch request tests pass.
- **WhatsApp session disclosure and manipulation:** Session/recipient guards check assignment access; mixed-branch sessions cannot be opened by staff lacking full access. Session history queries are scoped. Idempotency lookups also authorize the existing session before returning it.
- **Consent missing from API recipient selection:** The recipient query previously omitted the consent columns consumed by eligibility rules. The query now includes them; isolated tests demonstrate granted recipients are eligible and unknown recipients are blocked.
- **Queued send after opt-out/template change:** Queue processing rechecks consent, phone, active session and approved/supported template before attempting the send. An opt-out after preview produces a failed job without invoking mocked Meta.
- **Duplicate risk after network interruption:** Unknown network outcomes are no longer automatically retried; stale unknown submissions remain review-required. The retry endpoint excludes unknown-outcome records.
- **Manual status endpoint could reach API records:** Manual updates explicitly reject API recipients. Only provider callbacks set actual API delivery states.
- **Concurrent callback downgrade:** Status application uses compare-and-set and re-reads if another callback changed the row. Existing monotonic merge rules are preserved; a late sent event cannot downgrade delivered.
- **Public setup re-ran migrations after initialization:** Setup checks for an existing owner before running schema statements. First-owner creation and PG naming use a transaction with a locked settings row and a second owner-existence check. The concurrency property is source-reviewed, not stress-tested against hosted Neon.
- **Spreadsheet formula injection:** CSV fields neutralize formula prefixes rather than relying solely on quoting; an automated regression test passes.

### High — unresolved, approval or external validation required

- **Concurrent checkout/refund/deposit-reversal balance checks:** Balance reads precede separate writes. Simultaneous requests may over-use held deposits; duplicate concurrent checkout is not protected by the serial duplicate check. Proposed fix: serialize each resident's settlement, read balances under the same transaction/lock as conditional writes, and preserve paired deposit-to-rent entries atomically. **Do not use simultaneous settlement/refund actions in production until this is approved and tested.** No financial changes were applied.
- **Bulk discounts validate only the first resident's bill:** Later residents may receive a discount greater than their bill; validation and insertion are separate transactions. Proposed fix: validate every target under a shared transaction and reject an invalid batch atomically. Financial/credit policy needs approval first.
- **Charges lack a persisted idempotency key:** Double submission can add duplicate charge lines. Proposed fix: persist a request key for the entire charge batch and validate reused keys. This is an additive financial-schema change requiring review/approval.
- **Sensitive endpoint throttling is absent:** No login/initial-setup rate limiter is implemented. A durable deployment-specific limiter and abuse testing are required before production. In-memory worker counters are not a reliable substitute.
- **First setup is public on an empty deployment:** Initialize an empty deployment privately before sharing its URL. An optional one-time setup secret can be added after approval; transaction serialization prevents duplicate owners, but does not prove the first caller is the intended customer.

### Medium

- Current due-day update SQL touches a broader range than “open current-month bills”: current/future bills and some older bills due from the current month may be updated, including paid bills. **The agreed existing SQL behavior is preserved.** Narrowing this needs approval.
- PG timezone uses a module-level mutable variable. Simultaneous timezone-setting changes can produce a stale/cross-request date context. Proposed fix: request-local date context; approval is required because charge/billing dates are affected.
- Historical backfill after transfers may select the latest overlapping allocation's rent. No effective-dated rent revision history or immutable finalized checkout settlement snapshot exists.
- Refund idempotency collision returns success without confirming matching original fields. Payment keys also need collision-payload validation.
- Resident mobile validation is largely minimum-length based; database entry allows values that fail the stricter Indian WhatsApp normalizer. Stricter onboarding policy needs agreement, rather than silently rejecting existing contacts.
- Operational audit logs are not comprehensive; template audit exists, but resident/room/settlement edits do not have a complete general audit trail.
- Payments are limited to 2,000 rows and residents to 1,000 rows without complete server pagination. At high volume, monthly totals/exports based on the returned payment subset can be incomplete. Separate SQL totals plus paginated records are recommended.
- Dashboard/recipient/history calculations still have repeated per-resident line filtering. Simulated computation is acceptable at 500 residents, but live SQL plans and latency have not been benchmarked.
- Concurrent room archiving/bed removal/capacity changes versus onboarding remain check-then-write races. Serial occupied-bed checks pass; transactional locking needs further hardening before unrestricted concurrent use.
- Backup restoration and deployed Vercel execution have not been demonstrated. Configuration in source is not deployment proof.

### Low / remaining limitations

- ID photo upload intentionally disabled; manual masked Aadhaar remains available.
- Full Excel import/export, broad reports and downloadable locked checkout/PDF receipts are not established by this review; do not promise them in a demo.
- Client date defaults use the device timezone, whereas server rules use the PG timezone.
- No scheduler heartbeat exists; UI now reports unattended processing as “Not verified,” rather than implying a secret means it is active.

## 3. Staff branch permissions

- Roles remain Owner and Staff. No extra Manager role was created.
- Owner can select multiple branches when adding staff and edit assignments on each staff row in Settings → Staff.
- New staff messaging defaults to disabled; owner explicitly enables it. Existing true/false permission values are preserved.
- Authentication loads assignments from `staff_branches`; on an older database without the table, staff receive an empty scope, not all branches.
- Every branch-targeting mutation resolves actual record ownership from PostgreSQL; request-provided branch IDs are not sufficient authority.
- Resident financial history is treated as indivisible: staff need all branches represented by that resident's bills/allocations. Mixed-history detail access is denied and scoped resident/financial lists omit that resident; owner retains the complete history. This conservative policy prevents disclosure, rather than showing misleading partially redacted balances.
- Staff with no assignments see a clear request to ask the owner. Navigation reflects Settings and WhatsApp permissions, including mobile sign-out.
- API sends remain available to explicitly authorized messaging staff, but interactive queue processing is limited to their assigned resident branches; owner/internal signed runner can process all jobs. No unrequested API-specific role was added.

## 4. Migration

See `docs/phase4-migration.md`. New table: `staff_branches` with foreign keys and composite key; new branch index; default `can_message=false` for future users. **Not applied to the existing database.** No automatic assignments or ledger changes. Generated `db/schema.sql` matches the source schema. The isolated fixture applies the full schema twice and preserves resident/payment rows.

Before using staff management on the existing installation, an owner must review the migration and run **Settings → General → Update database structure**, then assign branches. That button also reruns older idempotent migrations; review before production use.

## 5. Automated and mocked testing

Baseline: **75 passing tests**. Final full suite: **102 passing tests across 11 files**, including **14 isolated PostgreSQL handler/integration tests** and the existing **34 mocked Meta tests**. Latest preview compilation reported **build OK**. No manual build/typecheck was run.

New coverage includes:

- Owner/unassigned/multiple-branch rules and explicit messaging permission.
- Real SQL/handlers against isolated PostgreSQL: repeated migration; signed-out rejection; scoped branch/rooms/vacancies/residents/dashboard/payments; direct forbidden resident/read/payment/charge/transfer requests; unassigned staff; immediate due-day updates; next-month charge rollover; idempotent bills/rent/payment; FIFO; occupied-bed restrictions; agreed-rent preservation; immutable ledger triggers; cross-branch WhatsApp history and preview; sequential checkout/rejection/refund; real consent query and send-time opt-out; provider-only API statuses; late delivery events.
- Password salt/verification/malformed stored hash tests.
- Real calendar date/month validation and positive safe-integer payments with required request keys.
- CSV formula prevention.
- Existing mocked Meta success/error/signature/template/mapping/retry/history tests remain active; no actual Meta requests are made by the tests.

The isolated database is PostgreSQL compiled to WASM, not hosted Neon: useful for SQL/transaction behavior, but not proof of hosted locking, network, or serverless deployment behavior.

## 6. Browser testing

**Actually exercised in the running preview:**

- Desktop 1280×1800, tablet 950×674, mobile 390×844 sign-in screens: screenshots reviewed; no horizontal overflow.
- An invented invalid account was rejected with “Wrong email or password.” No real login credentials were used.
- Direct signed-out visits to Dashboard, Residents, Rooms, Payments, WhatsApp and Settings redirected to `/login`.
- GET/POST queue processing without authorization returned 401.
- Invalid webhook subscription returned 403; unsigned POST webhook returned 401.
- No page runtime errors were observed in that run.

**Not completed:** successful owner/staff sign-in, signed-in navigation/forms, assignments read-back, full onboarding/payment/transfer/checkout UI, message queues, resident tabs, and signed-in desktop/mobile layouts. The preview is signed out and no self-contained app session was supplied; no temporary owner/session was inserted into the real database. These are outstanding acceptance checks, not passed browser tests. Sign in through the preview to make an authenticated review possible.

## 7. Performance

Representative **isolated computation**, each resident with 24 months of bill history, FIFO allocation, breakdown rendering, overdue filtering and duplicate checks:

| Residents | Measured in one local test run |
| --- | ---: |
| 50 | 34.9 ms |
| 100 | 26.7 ms |
| 300 | 94.5 ms |
| 500 | 116.4 ms |

These are not hosted page-load times or Neon SQL benchmarks. Differences at small sizes reflect local warm-up/noise. No hundreds of residents were inserted into the existing database. Live dashboard/list/search/reports/history latency, index EXPLAIN analysis and concurrent load testing remain unverified.

## 8. Security verification

- Cookie sessions are httpOnly, secure, sameSite lax, 30-day expiry checked on every authenticated call; inactive users rejected.
- Passwords remain PBKDF2-SHA256 (100,000 iterations), with format validation and full-length comparison; this review does not certify an optimal current cost or hosted login-rate protection.
- Source contains CSRF middleware for server functions. Cross-site POST enforcement was source-reviewed, not separately exercised with a real signed-in browser session.
- SQL values remain parameterized. New branch predicates use bound UUID arrays; entity/scope SQL identifiers come only from fixed internal allowlists.
- Database and Meta secrets remain server-only; no private credentials were added to source or displayed. No production bundle secret scan or independent penetration test was performed.
- Webhook uses the raw body with HMAC verification; process endpoint requires the cron bearer secret. Rejection checks were exercised against the live preview.
- Logout cancels/clears cached queries and replaces history; mobile sign-out is available. Successful logout/session-expiry browser checks remain outstanding.
- ID verification permission now includes transitions back to Pending; staff cannot reset an owner verification through a crafted update.

## 9. WhatsApp API and background limitations

No live Meta account is configured or connected during this work. Phone registration, permissions, Meta billing/quality limits, actual accepted/sent/delivered/read callbacks, signature delivery from Meta, template sync against a live account, and end-to-end live opt-out require live test-number validation later.

Jobs persist in Neon; browser closure does not remove them. Recovery/source rules and mocked behaviors are tested, but unattended drain with the browser closed is **not verified**. The exact external authenticated scheduling setup is documented in README; no scheduler is added. Unknown results require human review, never blind retry. Static text/positional body templates only; media headers, named variables and dynamic buttons remain unsupported.

## 10. Changed files

- `src/lib/access.ts`, `access.server.ts`, `access.test.ts` — new permissions/guards/tests.
- `src/lib/auth.server.ts`, `auth.functions.ts`, `auth.server.test.ts` — session assignment load, hash validation, setup transaction, login validation.
- `src/lib/pg.functions.ts` — branch scoping, assignment management, consent selection, provider-status guard, ID verification permission, room creation atomicity/capacity validation.
- `src/lib/schema.ts`, `db/schema.sql` — additive assignments/default migration.
- `src/lib/wa.ts`, `wa-api.server.ts`, `meta.ts`, `meta.test.ts` — explicit sending permission, scoped/revalidated queue, unknown-outcome retry safety, status concurrency, safe complete template pagination.
- `src/lib/validation.ts`, `validation.test.ts`, `export.ts`, `export.test.ts`, `performance.test.ts` — validation/export/performance rules and tests.
- `src/test/phase4.integration.test.ts`, `src/test/setup.ts` — isolated SQL integration suite and Node-capable test initialization.
- `src/routes/_app.tsx`, `_app.settings.tsx`, `_app.whatsapp.tsx`, `_app.residents.$id.tsx`, `_app.payments.tsx` — access controls, assignments, logout, consent/cooldown controls, safe CSV, scheduling status.
- All eleven content route files received leaf `og:type` and `twitter:card` metadata; unique existing page titles/descriptions preserved.
- `package.json`, `bun.lock` — development-only isolated PostgreSQL dependency.
- `AGENTS.md`, `roadmap.md`, `README.md`, `docs/phase4-migration.md`, this report — architecture and operational documentation. Project memory updated to preserve current due behavior and Phase 4 restrictions.

## 11. Demo readiness and next decisions

**Suitable for a limited, supervised demo only after the migration is reviewed and signed-in workflows are checked against a separate demo database. Not production ready yet.** Vercel build preset is configured; actual Vercel deployment is not verified and was not performed. ID upload remains visibly disabled. Manual WhatsApp remains the default, centralized templates preserved, Settings WhatsApp tab not recreated.

Before Phase 5:

1. Approve resident-serialized settlement/refund/reversal protections, batch-discount validation, and charge idempotency; implement and stress-test on an isolated database.
2. Review/apply additive branch migration and assign staff; authenticate owner/staff and finish end-to-end UI acceptance.
3. Add durable login/setup throttling and privately initialize empty deployments.
4. Verify separate demo deployment, production-compatible SQL/concurrency, pagination/totals, backup restore and realistic hosted load.
5. If API is wanted, use Meta test numbers and prove authenticated scheduler processing after browser closure; only then assess live readiness.

No Phase 5 work has started. Outstanding steps remain explicit in `roadmap.md`.