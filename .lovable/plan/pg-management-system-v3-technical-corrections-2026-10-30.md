# PG Management System — v3 Technical Corrections

This part replaces any conflicting parts of v2 (further down this document). All functional requirements in v2 still apply. Planning only: no code, no provisioning.

Sources checked on 30 Oct 2026: Neon plans docs, Neon pricing page, Neon "Managed Better Auth" docs, the Neon changelog of 12 Dec 2025, and Neon's own Neon-vs-Supabase free-plan guide. Neon's figures below come from Neon's own pages. Supabase figures were not re-checked this round and stay **[UNVERIFIED]**.

## C1. Monthly rent generation (corrected)

**Eligibility.** A resident gets exactly one bill for billing month M when all of these hold:
- An allocation overlaps M, meaning it starts on or before the last day of M and has not ended before the 1st of M.
- M is on or after the resident's billing start month. That is the joining month, or for imported residents, the migration month.
- M is not after the checkout month.

**Idempotency.** There is a unique key on (resident, month). Generation inserts and skips rows that already exist. A mid-month transfer does not create a second bill, because the bill belongs to the resident, not the allocation.

**Rent amount.** The full agreed rent (see C2) that is in force on the later of the 1st of M or the allocation start date. There is no proration.

**When bills are created:**
- **At onboarding:** the joining-month bill is created in the same transaction.
- **Backdated onboarding** (joined in an earlier month): one bill per month from the joining month to the current month, each at full rent. The user sees a preview and confirms.
- **Daily cron / first request of the month / manual button:** the job checks every eligible resident across the current month *and any earlier months since their billing start that have no bill*. This catches late entries, failed jobs and gaps.
- **Imported residents:** no bills before the migration month. Their previous dues go in as an opening-balance line on the migration-month bill. Imported historical allocations are kept for history only and never produce bills before the migration month.
- **Checkout in month M:** the bill for M already exists, since the resident occupied a room during M. No bill is created for later months.

**Report:** a "Billing coverage" check lists any eligible resident-month that has no bill. The expected result is zero.

## C2. Room rent vs per-bed rent

- **Per-bed mode:** each bed has its own rent. A new resident's agreed rent defaults to the bed's rent and can be edited at onboarding.
- **Per-room mode:** the room has a **total room rent R** and a capacity C.
  - The default rent per share is R ÷ C, rounded to whole rupees. Any leftover rupees go to the first beds (proposed).
  - Rent is **not** R ÷ current occupants. Otherwise every resident's rent would change whenever someone joins or leaves.
  - A vacant share simply means less income for the owner, and reports show it as "potential vs actual".
- **Agreed rent is a contract.** It is stored on a resident rent agreement with the amount, the month it takes effect from, and the reason. Changing room rent, capacity or mode affects **only future allocations' defaults**.
- **Changing existing residents' rent** needs an explicit "Change agreed rent" action. It asks for the residents, the new amount, the effective month (current or later) and a reason. It is recorded in the audit log. If the effective month is the current month, the current bill gets an adjustment line rather than a rewrite.
- **Capacity changes in per-room mode** recalculate the default share for new allocations, e.g. 2-share at R = ₹12,000 is ₹6,000 per share, and 4-share at R = ₹16,000 is ₹4,000. A warning lists the current occupants whose agreed rent differs from the new default. They stay unchanged unless the owner applies the change explicitly.

Schema additions:
- `rooms.total_rent` is used in per-room mode.
- `rent_agreements` (resident, allocation, monthly rent, effective month, reason, created by) replaces the rent field on allocations. The latest agreement on or before month M applies.

## C3. Locking finalized checkouts

- A checkout has two stages. **Draft** is fully editable. **Finalized** records when and by whom. Finalizing freezes the settlement snapshot, issues the Settlement Statement, and closes all of the resident's bills.
- After finalization, database triggers block new bill lines, charge allocations, deposit entries and payment applications on that resident. The only exceptions are refund payments up to the refund due, and approved post-checkout adjustments.
- **Post-checkout adjustment workflow:**
  1. Any permitted user can *request* a change, giving the lines, the reason and the effect on refund/dues.
  2. **Only the Owner can approve or reject it.**
  3. On approval, one transaction posts the adjustment lines (each linked to the adjustment), creates settlement revision n+1 with its own snapshot, and issues a "Revised Settlement Statement" that references the original receipt number.
- **Issued receipts are never changed or reissued under the same number.**
- If a revision lowers the refund due below what has already been refunded, the difference becomes an amount the resident owes. It is never a negative refund.
- Bulk or room charges that select a checked-out resident with a finalized checkout do not post directly. The preview flags them and creates **adjustment requests** that the owner must approve. Draft checkouts accept the charges normally.

Schema additions:
- `checkouts` gets status (draft, finalized), finalized at/by, and a current revision number.
- New table `checkout_revisions`: revision number, snapshot, refund due, amount owed, receipt id.
- New table `post_checkout_adjustments`: checkout, requested by, reason, proposed lines, status (requested, approved, rejected), decided by/at, revision id.

## C4. Overdue reminder policy (revised, user-friendly)

Proposed default (needs approval):
- **First reminder:** enabled the day after the due date, if the balance is above zero.
- **After the manager marks it sent:** the button stays disabled for **7 days**. The interval is configurable per branch, between 3 and 30 days.
- **A partial payment never re-enables the reminder by itself.** The reminder just shows the new, lower balance the next time it is due.
- It re-enables earlier only when the **overdue amount increases**, for example a new charge on an overdue bill, or a reversed payment.
- **A new month's bill becoming overdue** creates one combined reminder per resident, listing every overdue month. It does not create one reminder per bill.
- **A fully paid balance** disables and clears the reminder.
- **"Send again now"** stays available in the resident's detail page as a deliberate action, and is logged.
- **Concurrency:** the version-safe rule from v2 still applies. Marking an older version as sent never covers a newer one. The cooldown starts from the time recorded on the newest version marked as sent.
- **Residents page column** shows one of: "Due now", "Sent 3 days ago, next in 4 days", or "Not overdue".

## C5. Infrastructure re-evaluation with Neon Managed Better Auth

What Neon currently offers on its **Free plan** (from Neon's docs and pricing page):
- 100 projects.
- Per project: 100 CU-hours of compute a month, 1 GB storage (20 GB across the whole account), 5 GB data transfer out, 10 branches.
- The database sleeps after 5 minutes idle, cannot be kept awake on Free, and wakes in a few hundred milliseconds.
- About a 6-hour undo window.
- **Managed Better Auth:** up to 60,000 monthly active users per project, included free.
- **Neon Functions:** 1 million invocations per project, free during beta.

Managed Better Auth (rebuilt on Better Auth in Dec 2025):
- Neon hosts and runs the sign-in endpoint. **Password hashing runs on Neon, not inside the Cloudflare Worker.** This removes the v2 concern about the Worker's CPU limit.
- Users, sessions, settings and signing keys live in a `neon_auth` schema inside the customer's own database, so they can be queried with SQL and used in row-level security.
- Tokens are checked against Neon's public signing keys, so the Worker only verifies a signature (about 1 ms).
- Neon's Data API (beta) can also check tokens and apply row-level security.

**Neon Functions are not needed.** All app logic runs on the Cloudflare Worker. Making Functions a core dependency would add a beta service and lock-in.

| Criterion | Neon + Managed Better Auth + Cloudflare | Supabase Auth + Postgres + Cloudflare |
|---|---|---|
| Idle behavior | Sleeps after 5 min and wakes by itself. **No manual restore** | Pauses after about 7 days idle, and someone must resume it manually **[UNVERIFIED]** |
| Free projects | 100. Each project has its own quotas | 2 active per account **[UNVERIFIED]**. Not an issue if each customer uses their own account |
| Free quotas | 1 GB storage, 100 CU-hours a month. A PG of under 300 beds is expected to use well under 30 CU-hours **[estimate; PoC measures]** | ~500 MB storage **[UNVERIFIED]** |
| Auth CPU on the Worker | Signature check only | Signature check only |
| Auth maturity | Managed service is newer (Dec 2025). Better Auth itself is widely used | Mature, many years in production |
| Auth data in backups | Same database (`neon_auth` schema) | Separate `auth` schema in the same database |
| Free-tier backups | About 6-hour undo window. No long-term snapshots | No downloadable daily backups on Free **[UNVERIFIED]** |
| Database access from the Worker | Neon's serverless driver over HTTP/WebSocket. Transactions are supported | Database functions called through Supabase's REST API. Direct database access needs extra setup |
| Lovable development fit | Lovable connects to it as an external database. Database migrations are files I write | Same code as Lovable Cloud, so the most direct fit |
| Commercial use | Allowed on Free. No uptime guarantee | Allowed. No uptime guarantee **[UNVERIFIED]** |
| Paid upgrade path | Usage-based Launch plan, about US$0.106 per CU-hour plus storage at US$0.35 per GB-month | Pro plan at about US$25 a month **[UNVERIFIED]** |

**Revised recommendation (needs approval): Neon + Managed Better Auth + Cloudflare Workers Free, provided the proof of concept in C7 passes.** It has no idle-pause risk and per-project free quotas. Auth hashing happens off the Worker. Auth data lives in the customer's own database.

**Fallback: Supabase** if the PoC fails on any of these:
- restoring auth accounts,
- the cost of waking from sleep,
- the maturity of the managed auth service.

The data layer is built as plain SQL functions with no provider-specific calls, so switching providers costs little.

## C6. Backup and restore feasibility by provider

| Item | Neon (Managed Better Auth) | Supabase |
|---|---|---|
| App data, relationships | Full database dump of the app schema. The restore tool recreates relationships and constraints in a valid order | Same |
| Number sequences | The dump stores current sequence values. After restore, the checks confirm each sequence is at or above the highest used number | Same |
| Roles, branch assignments, permissions | Ordinary app tables, so they are fully restored | Same |
| User accounts and password hashes | Stored in `neon_auth` tables. **Restoring into the *same* project** (undo window, or a branch created from a past point) brings back everything, including sessions. **Restoring into a *new* project:** dumping and loading `neon_auth` into a freshly set-up auth service is **[UNVERIFIED]**. It may be blocked by managed-schema permissions or key mismatch. The PoC tests this | User records and password hashes in `auth.users` / `auth.identities` can be dumped and loaded into a new project. Supabase documents this for project migrations **[UNVERIFIED in detail]** |
| Sessions | Intentionally **not** carried to a new project. New signing keys make old sessions invalid, and everyone signs in again. This is acceptable and safer | New project keys make old sessions invalid. Everyone signs in again |
| Guaranteed fallback | A small staff list (Owner, Managers, Staff). The restore script recreates each account and sends password-reset or temporary-password setup, using restored user ids so roles still match. **Proposed:** app user ids are mapped to auth user ids through a `profiles.auth_user_id` column. A restore can then re-link accounts without rewriting any financial records | Same |
| Long-term retention | Daily scheduled backup (GitHub Actions) to the customer's R2 storage, encrypted. Neon's undo window covers recent mistakes | Same. Free tier has no managed backups |
| Verification | Weekly test restore into a scratch database checks row counts, money totals, relationships, ledger rules and sequences. A quarterly drill restores into a new Neon project, including sign-in | Same |

**Conclusion:** app, financial and permission data can be restored reliably on both providers. Restoring passwords into a *new* project is proven for Supabase and unproven for Neon, so it is a PoC item. In either case the account re-link fallback means no financial or permission data depends on it.

## C7. Proof of concept (described only, not executed)

**Goal:** prove the chosen stack end to end before full development.

**Needs your approval** to create a free Neon project and a free Cloudflare account (or to use the customer's accounts).

1. **Setup:**
   - A Neon Free project with Managed Better Auth (email + password).
   - A minimal TanStack Start app deployed to Cloudflare Workers Free at a `*.workers.dev` address.
2. **Login:**
   - Sign in, then a server function verifies the token signature and reads the user's role.
   - Pass: a valid user gets in. Bad or expired tokens are rejected. No password hashing happens on the Worker, as seen in the Cloudflare CPU stats.
3. **Database access:**
   - The server function runs a protected query that respects branch assignment.
   - Pass: a manager on branch A cannot read branch B, whether through the server function or through a hand-made request.
4. **Financial transaction:**
   - A database function records a payment: it locks the resident, records the payment, applies it oldest-bill-first, and checks the totals.
   - Pass:
     - 20 parallel payments with distinct request keys give exact totals and no rule violations.
     - 20 parallel duplicates with the same key result in exactly one payment.
     - A reversal can happen only once.
5. **Bulk charge:** ₹6,000 split across 60 residents in one transaction, then submitted again with the same key. Pass: one batch, total exactly ₹6,000.
6. **Performance:**
   - Cloudflare server time under 10 ms at the 95th percentile on login, residents list and payment.
   - Response after the database has slept for 5 minutes or more: under 2 s.
   - Measure CU-hours used for a simulated month of 200 residents.
   - App bundle under 3 MB.
7. **Backup and restore:**
   - Full dump including `neon_auth`, then restore into a **new** Neon project.
   - Pass: all checks match, and sequences continue without clashes.
   - Record whether existing passwords still work after restore. If they don't, run the re-link fallback and confirm sign-in works with unchanged roles.
8. **PDF and import:** create a 2-page receipt in the browser, and import 500 rows in chunks. Pass: no Worker CPU limit errors.
9. **Output:** a short pass/fail report with measured numbers. This becomes the go/no-go decision for Neon versus Supabase.

## Remaining risks

- Neon Managed Better Auth (Dec 2025) and the Data API and Functions (beta) are new. Limits or terms may change. Supabase figures were not re-checked this round.
- Waking from sleep adds latency to the first request after 5 minutes idle. It cannot be turned off on Free.
- Restoring passwords into a new Neon project is unproven. The re-link fallback covers it.
- Workers Free CPU limit on page rendering is still to be measured. The Workers Paid plan at about US$5 a month is the fallback **[UNVERIFIED]**.
- Each customer adds one-time setup steps: GitHub Actions, R2 storage and an encryption key.

## Decisions requiring your approval

1. Infrastructure: Neon + Managed Better Auth + Cloudflare, with Supabase as the fallback, depending on the PoC.
2. Permission to create free trial accounts for the PoC (yours or a test customer's).
3. Per-room default rent split: room rent ÷ capacity (proposed), with leftover rupees going to the first beds.
4. Overdue reminder interval: 7 days by default, configurable per branch from 3 to 30 days. Partial payments do not re-enable reminders.
5. Charges on finalized checkouts go through owner-approved adjustment requests (proposed).
6. Backup destination (R2 proposed) and who holds the encryption key.
7. Earlier open items from v2: receipt number formats, how long to keep phone numbers after checkout (3 years proposed), and how staff reset passwords (by email, or the owner resets them).

---

# PG Management System — Revised Planning Report (v2, base document)

Planning only. No code, tables, connections or provisioning until you approve. Figures marked **[UNVERIFIED]** are taken from providers' public pricing and docs as I last knew them. Each must be re-checked against current terms before a final decision.

Adopted defaults:
- Rent per room or per bed (chosen per room).
- Calendar-month billing.
- Branch due day with optional resident override.
- Manual current-month adjustment on transfer.
- Deposit deductions need confirmation.
- Payment reversals need owner-granted permission.
- No late fees.
- English UI with editable WhatsApp templates.

---

## 1. Understanding of the Product

A single-tenant, licensed web app. Each customer (a PG business) gets its own Cloudflare deployment and its own Postgres database, both under the customer's accounts. Inside one deployment, an Owner runs many branches with Managers and Staff. There is no resident login.

Core workflows:
- **Setup:** branches, then rooms (AC/Non-AC, capacity, rent mode), then beds.
- **Onboard:** pick a vacant bed, enter details and terms, set the first bill (standard rent ± manual discount/adjustment with a reason), record payments (rent/deposit), then send the WhatsApp welcome.
- **Monthly:** one bill per resident per calendar month (idempotent). Charges (individual, room-wise, bulk) are added. Payments come in (partial, cash/UPI/bank). Bills are shared. Overdue reminders go out after the due date.
- **Changes:** transfers (same or cross-branch), room reconfiguration, rent changes, corrections through reversals.
- **Checkout:** settlement, with the deposit applied after confirmation. The refund is recorded as pending, partially paid or completed, with an accurate PDF. The bed is released. History is kept.
- **Admin:** import, verified backup/restore, reports, audit, permissions, templates.

## 2. Recommended Technology Stack

| Layer | Choice |
|---|---|
| UI | React 19, TanStack Start, Tailwind v4, shadcn/ui (mobile-first) |
| Server | TanStack server functions on Cloudflare Workers (customer account) |
| Database | PostgreSQL. All money operations are SQL functions running in one transaction with row locks |
| Auth | Depends on the provider choice (section 3) |
| PDF | Generated in the browser (`pdf-lib`), so it costs no server CPU |
| Excel/CSV | Parsed in the browser (SheetJS). The server validates and commits in chunks |
| Files | None. No document uploads |
| Backups | Scheduled `pg_dump` via GitHub Actions to customer-owned object storage, plus an in-app backup |

## 3. Provider Comparison — both on customer-owned Cloudflare Workers

| Criterion | **A. Supabase (Postgres + Auth)** | **B. Neon Postgres + self-managed auth (Better Auth in the same DB)** |
|---|---|---|
| Free DB quota | ~500 MB per project, 2 active free projects per account **[UNVERIFIED]** | ~0.5 GB per project, a monthly compute-hour allowance, ~10 branches **[UNVERIFIED]** |
| Inactivity | **Project pauses after ~7 days of no activity [UNVERIFIED].** It must be restored manually from the dashboard. Data is kept but the app is down until restored | Compute auto-suspends after ~5 minutes idle and resumes automatically on the next query (~0.5–1s cold start) **[UNVERIFIED]**. There is no manual-restore step |
| Commercial use on free tier | Allowed, no SLA **[UNVERIFIED]** | Allowed, no SLA **[UNVERIFIED]** |
| Managed backups on free tier | No downloadable daily backups on Free **[UNVERIFIED]** | Point-in-time restore window of about 1 day (~24h) on Free **[UNVERIFIED]**. No long-term backups |
| Auth | Built in, mature. Password hashing runs on Supabase servers, so **no Worker CPU cost**. Password reset email via the built-in mailer (low rate limit **[UNVERIFIED]**) | The app owns auth. Password hashing (scrypt) runs **inside the Worker**, so it may exceed the Free CPU limit (section 9). Reset emails need an email provider (e.g. Resend free tier **[UNVERIFIED]**) or owner-assisted reset |
| Auth data in backups | `auth.users` lives in a separate schema. Exporting it needs `pg_dump` with DB credentials (possible) | Users, sessions and accounts are ordinary tables in the same DB. A single `pg_dump` covers everything |
| Data-layer security | RLS through PostgREST as a second guard layer | No PostgREST. Access is enforced in server functions plus SQL functions using a session-variable user id. RLS is possible but custom |
| Lovable development fit | High. Lovable Cloud is Supabase-compatible, so dev and production use the same code | Medium. Needs a Drizzle/SQL data layer and custom auth. More code to own and maintain |
| Deployment per customer | Create project, run migrations, set 3 env vars, deploy Worker | Create project, run migrations, set env vars (DB URL, auth secret, email key), deploy Worker |
| Long-term risk | Pause on inactivity. Free project count per account. Price changes. Pro ~US$25/month **[UNVERIFIED]** | Compute-hour cap could be hit by heavy use. Auth code is your responsibility (security patches). Launch tier usage-based ~US$5+/month **[UNVERIFIED]** |
| Paid upgrade path | Supabase Pro adds daily backups and no pausing | Neon Launch adds longer point-in-time restore and more compute |

**Tradeoff summary**
- **Supabase** is lower build effort and uses battle-tested auth with zero Worker CPU for hashing. Its weak points are the inactivity pause (mitigated by a daily cron query, which a busy PG doesn't need anyway) and no free backups (mitigated by section 11).
- **Neon** never needs a manual restore after idle and gives one-dump backups. The cost is more custom code, auth security responsibility, and a CPU-limit risk on Workers Free.

**Recommendation (needs your approval):** Supabase (A) for the first release. It keeps the main risk on infrastructure the customer controls and minimizes custom security code. The data layer is written as SQL functions, so a later migration to Neon stays possible. If you consider the pause risk unacceptable, choose B, and budget Workers Paid (~US$5/month **[UNVERIFIED]**) for the auth CPU.

Other items:
- Subdomain `*.workers.dev` is free. A custom domain is the customer's cost.
- Cloudflare R2 free ~10 GB for backups **[UNVERIFIED]**.
- GitHub Actions free minutes for private repos ~2,000/month **[UNVERIFIED]**.
- Vercel Hobby is excluded (non-commercial terms **[UNVERIFIED]**).

## 4. System Architecture

```text
Browser ── HTTPS ── Cloudflare Worker (customer account)
                      TanStack SSR + server functions
                      1. verify session  2. load role/branches/permissions
                      3. call SQL function (transaction, row locks, re-checks permission)
                    ── Postgres (customer account)
Cron Trigger (daily 00:30 IST) ── ensure_bills(), keep-alive
GitHub Actions (daily) ── pg_dump ── encrypted ── R2 / customer storage
```

- Isolation: one deployment and one database per customer. No shared tenant data.
- Master codebase: versioned migrations, a `schema_version` table, and a deployment runbook plus script (create DB, migrate, seed owner, set env, deploy, set up the backup job, run a restore drill).
- Updates: the same migration set is applied per customer. Each customer's `schema_version` is tracked in a deployment register you keep.

## 5. Corrected Database Schema

Conventions:
- Money is `bigint` paise.
- Every table has `id uuid`, `created_at`, `created_by`.
- Mutable tables also have `updated_at` and `row_version int` (optimistic locking).
- Financial tables are **append-only**: UPDATE/DELETE are revoked and blocked by trigger.
- Constraint triggers marked `DEFERRABLE INITIALLY DEFERRED` check the invariants at commit.

**Access**
- `business_settings` (1 row): pg_name, address, phone, receipt_prefixes, timezone, migration_date, default_due_day (1–28).
- `branches`: name, address, phone, due_day (1–28, null means use the default), is_active.
- `profiles`: user_id, full_name, phone, is_active.
- `user_roles`: user_id, role enum(owner, manager, staff). Unique (user_id, role). Checked by the security-definer function `has_role()`.
- `branch_assignments`: user_id, branch_id. Unique pair.
- `user_permissions`: user_id, permission enum. Unique pair. Values: collect_payment, add_charge, reverse_charge, apply_discount, reverse_payment, record_refund, deposit_deduction, checkout, transfer, cross_branch_transfer, edit_resident, edit_rooms, export, view_reports.

**Inventory** (status is derived and is only ever Vacant or Occupied)
- `rooms`: branch_id, room_number, floor, is_ac, capacity (≥1), rent_mode enum(per_room, per_bed), room_rent (per_room: monthly rent per occupant), is_active. Unique (branch_id, room_number) among active rooms.
- `beds`: room_id, label, bed_rent (per_bed mode), is_active. Unique (room_id, label).
- Trigger: the count of active beds must equal room.capacity. Deactivating an occupied bed is rejected.
- View `bed_status`: Occupied if an open allocation exists, otherwise Vacant. View `room_occupancy`: occupied/capacity and vacant count.

**Residents and occupancy**
- `residents`: code (unique, from a sequence), name, mobile, alt_mobile, current_branch_id, status enum(active, checked_out), joining_date, checkout_date, monthly_rent, due_day_override (1–28, null), deposit_agreed, notes.
- `allocations`: resident_id, bed_id, branch_id, start_date, end_date null, monthly_rent, reason.
  - Partial unique index (bed_id) WHERE end_date IS NULL: no double booking.
  - Partial unique index (resident_id) WHERE end_date IS NULL: one active bed per resident.
  - Exclusion constraint (bed_id, daterange) blocks overlapping history.

**Bills** (the receivable side)
- `bills`: resident_id, branch_id, billing_month (first of month), due_date (snapshot), content_version int, balance_version int, is_closed.
  - **Unique (resident_id, billing_month).**
- `bill_lines` (append-only): bill_id, kind enum(rent, discount, adjustment, extra_charge, opening_balance, reversal), description, amount (signed: charges +, discounts −), reason (required for discount/adjustment/reversal), charge_allocation_id null, reverses_line_id null **unique** (a line can be reversed at most once).
  - Check: a reversal amount equals −(the original amount).
- Bill payable = sum(bill_lines.amount). A constraint trigger requires payable ≥ 0.

**Cash ledger** (the money side). Every row is a real movement of money. All amounts are positive.
- `money_transactions` (append-only):
  - direction enum(in, out), amount > 0, account enum(rent, deposit).
  - purpose enum(rent_payment, deposit_receipt, deposit_refund, credit_refund, reversal).
  - method enum(cash, upi, bank), reference, txn_date, resident_id, collected_by, idempotency_key **unique**.
  - reverses_txn_id null **unique**. Check: a reversal has the opposite direction, the same amount, account and resident as the original.
  - checkout_id null (refunds).
- `applications` (append-only), which ties rent-account money to bills: txn_id null, source enum(cash, credit, deposit), bill_id, amount (signed: + apply, − unapply), reason.
- `deposit_entries` (append-only, non-cash deposit movements): resident_id, kind enum(deduction_damage, deduction_other, applied_to_dues, adjustment), amount > 0, reason, confirmed_by, checkout_id null, reverses_entry_id null unique.

**Derived balances** (views, never stored). These are the invariants checked by constraint triggers at commit:
- Bill paid = sum(applications.amount for the bill). Rule: 0 ≤ paid ≤ payable.
- Bill outstanding = payable − paid.
- Rent credit (unapplied money) = rent-account cash in − rent-account cash out (reversals of payments, credit refunds) − sum(applications where source = cash) + sum(applications where source = credit, unapplied) … Simplified rule: **credit = Σ rent cash net − Σ applications net ≥ 0.**
- Deposit held = deposit cash in − deposit cash out − Σ deposit_entries (deductions/applied) ≥ 0.
- `applied_to_dues` deposit entries must exactly match deposit-source applications in the same transaction.

**Charges**
- `charge_heads`: name (Electricity, Water, Maintenance, custom), is_active.
- `charge_batches`: branch_id null, billing_month, charge_head_id, mode enum(bulk_equal, room_split, individual), total_amount, note, idempotency_key **unique**, fingerprint (hash of head + month + sorted resident ids + amount), status enum(active, reversed).
- `charge_batch_rooms`: batch_id, room_id, amount (room_split mode).
- `charge_allocations`: batch_id, resident_id, bill_id, room_id null, amount > 0. Unique (batch_id, resident_id).
- Soft-duplicate check: an existing active allocation with the same (resident, month, charge_head) triggers a warning and requires an explicit "add anyway" with a reason.

**Checkout**
- `checkouts`: resident_id **unique**, checkout_date, settlement jsonb (frozen snapshot), refund_due ≥ 0, amount_owed_by_resident ≥ 0, receipt_no (unique, sequence), status derived.
- Refund paid = Σ out-transactions of type deposit_refund/credit_refund linked to the checkout, net of reversals. Status: pending (0), partially_refunded, refunded (paid = due). Rule: paid ≤ due.
- `receipts`: kind enum(payment, settlement, refund), number (unique, per-kind sequence), source ids, snapshot jsonb, issued_at. Every receipt can be reissued from its snapshot.

**Notifications**
- `whatsapp_templates`: type enum(welcome, bill, overdue), branch_id null, body, row_version.
- `notification_state`: bill_id, type enum(bill, overdue), last_sent_version int. Unique (bill_id, type).
- `notification_log` (append-only): resident_id, bill_id null, type enum(welcome, bill, overdue), billing_month, sent_version, amount, message_text, marked_by, marked_at.

**Import / backup / audit**
- `import_jobs`: type, file_name, rows, status, error_report jsonb, committed_by.
- `backup_runs`: kind (scheduled/manual), started/finished, file_ref, sha256, manifest jsonb (row counts, money checksums, sequence values), verified_at, verify_result.
- `audit_log` (append-only, written by trigger): table_name, row_id, action, before, after, changed_by, reason, at.
- `schema_version`.

**Indexes**
- residents (mobile), trigram index on name, code.
- bills (branch_id, billing_month), bills (due_date) where open.
- applications (bill_id), money_transactions (resident_id, txn_date).
- allocations (bed_id, start_date).
- audit_log (table_name, row_id).

## 6. Roles and Permissions Matrix

| Capability | Owner | Manager (assigned branches) | Staff (assigned branches) |
|---|---|---|---|
| Branches, settings, templates, staff, import, backup/restore | Yes | No | No |
| Rooms/beds edit | Yes | Yes | if `edit_rooms` |
| Onboard / edit resident | Yes | Yes | if `edit_resident` |
| Transfer within branch | Yes | Yes | if `transfer` |
| Cross-branch transfer | Yes | if `cross_branch_transfer` AND assigned to both branches | No |
| Add charges / discounts | Yes | Yes | if granted |
| Reverse charges | Yes | Yes | if `reverse_charge` |
| Collect payment | Yes | Yes | if `collect_payment` |
| **Reverse payment** | Yes | **only if granted** | only if granted |
| Deposit deduction (confirmation dialog) | Yes | Yes | if `deposit_deduction` |
| Checkout / record refund | Yes | Yes | if granted |
| WhatsApp share + Mark as Sent | Yes | Yes | Yes |
| Reports / exports | All + consolidated | Own branches | if granted |
| Audit log | All | Own branches | No |

Permissions are enforced three times: the UI hides actions, the server function rejects, and the SQL function re-checks `has_role` / assignment / permission (plus RLS on Supabase).

## 7. Page and Navigation Structure

Bottom tabs on mobile (Dashboard, Residents, Collect, Rooms, More). Sidebar on desktop. A branch switcher at the top.

1. **Login** / password reset.
2. **Dashboard:** KPIs, trend, overdue list. Filters for branch, month and date range.
3. **Residents (central):**
   - Search by name, mobile or ID. Filters for branch, room, payment status, bill-share status, reminder status, and "occupied during month" (includes checked-out).
   - Columns as specified.
   - Row actions: view, edit, change room, charges, collect, history, share bill, overdue reminder, checkout.
   - **Bulk toolbar:** select residents, then Add Bulk Extra Charge.
4. **Resident detail:** tabs for profile, bills, payments/refunds, deposit, transfers, notifications, audit.
5. **Onboarding wizard.**
6. **Collect payment** dialog (rent or deposit).
7. **Change room** dialog.
8. **Checkout wizard**, plus **Record refund payment** dialog.
9. **Extra charges:** month view of batches/allocations, a room-wise entry grid, and reversals.
10. **Rooms & beds** (per branch, "2/4 · 2 vacant").
11. **Branches.**
12. **Ledger** (all money transactions, reversals).
13. **Pending refunds** list.
14. **Reports + exports.**
15. **Notification history.**
16. **Import.**
17. **Backup & restore** (status, last verified backup, manual backup, restore guide).
18. **Settings:** business, due days, templates, staff and permissions, audit log.

Every page gets skeleton loading, empty states with a next-step button, error states with retry, and confirmation dialogs showing exact ₹ amounts.

## 8. Detailed Business Logic

**Due dates**
- due_date = billing_month + (resident.due_day_override ?? branch.due_day ?? default_due_day) − 1.
- It is snapshotted on the bill. Changing a due day updates future bills. Updating open bills is an audited, explicit option.

**Bill generation (no always-on server)**
- `ensure_bills(month)` inserts with `ON CONFLICT DO NOTHING` for residents with an open allocation on the 1st of the month. The rent line = allocation.monthly_rent. No proration.
- Runs from: the daily Cron Trigger, the first authenticated request of the month (cheap existence check), and a manual button.
- The join-month bill is created at onboarding. Imported residents get bills only from the migration month.

**Payment application** (`collect_payment` SQL function)
1. Lock the resident row (`FOR UPDATE`), which serializes all of that resident's money operations.
2. Insert money_transaction (in, rent).
3. Apply oldest-first to open bills: application amount = min(remaining, outstanding).
4. Any remainder stays as credit (unapplied).
5. Bump `balance_version` on affected bills. A duplicate idempotency key returns the existing result.

**Credit use:** when a new bill is created or a charge is added and credit > 0, the system auto-applies credit (source = credit) in the same transaction.

**Payment reversal** (requires permission)
- Lock the resident. Insert a reversal transaction (out, same amount, `reverses_txn_id`; uniqueness means it can only be reversed once).
- Insert negative applications for each application of the original, which un-applies it.
- If the original's money was partly sitting as credit, that credit is consumed.
- The invariants are re-checked at commit.

**Charge reduction below paid** (reversal of a line on a paid bill): the same transaction un-applies the excess (negative application). That money returns to credit, so paid ≤ payable always holds.

**Discount/adjustment:** a new bill line with a reason. Never an edit.

**Transfer**
- Lock both beds and the resident. Close the old allocation (end_date = transfer date). Open the new one with the new rent.
- The current bill is unchanged. The user may add a manual adjustment line (default per your rule).
- Next month uses the new rent. Cross-branch moves update current_branch_id. Old bills keep their branch.

**Room reconfiguration**
- Capacity increase adds beds.
- Capacity decrease is allowed only if enough beds are vacant. The user picks which vacant beds to deactivate.
- Switching rent mode or rent applies to new allocations. Optionally it applies to current occupants from a chosen month, as an audited allocation-rent change.
- An AC change and room-number rename are audited.

**Bulk extra charge (from the Residents page)**
1. Choose billing month and charge head, enter the total, and select residents. The selection list defaults to **residents with any allocation overlapping the billing month**, including those who checked out during it. Filters: branch, room, manual tick.
2. Split: per = floor(T/N). The first T mod N residents (sorted by branch, room, bed) get +1 paisa, so the sum is exactly T.
3. Preview table: resident, room, status, amount. Flags for checked-out residents with a settled checkout, and a soft-duplicate warning (same head + month).
4. Confirm, then one transaction: lock the residents, ensure bills exist for that month (created for checked-out residents if missing), insert the batch, allocations and lines, auto-apply credit, and bump the bill versions.
5. Duplicate protection:
   - A unique idempotency key per form.
   - Fingerprint match means "an identical batch already exists".
   - The button is disabled while the request is pending.
6. Charging a resident whose checkout is already settled increases amount_owed_by_resident. If a refund is still pending, it reduces refund_due **only with explicit confirmation**. Both cases are flagged in the preview.

**Room-wise split:** enter amounts per room in a grid. Each room's amount is split equally among the residents allocated to that room during the month (default: occupants on the month's last day or checkout day, editable). Same rounding, same transaction.

**Individual charges:** add, or reverse plus re-add to correct. All audited.

**Deposits:** received in parts via deposit receipts. Outstanding = agreed − held. Deductions are always a confirmation dialog with a reason.

**Checkout settlement**
1. Show standard rent and outstanding for each open bill.
2. Manual adjustments with reasons (e.g. a rent refund for unused days, entered as a negative adjustment line).
3. Confirm deposit deductions.
4. Apply deposit to dues (deposit_entries `applied_to_dues` plus deposit-source applications).
5. refund_due = remaining deposit + rent credit. amount_owed = any remaining outstanding.
6. Freeze the snapshot, close the allocation (bed becomes Vacant), set resident to checked_out, issue the **Settlement Statement** (receipt kind settlement).

**Refund payments** (any number, later)
- Each is an out-transaction linked to the checkout (method, reference, date), up to the remaining refund.
- Each issues a **Refund Receipt**. Status moves pending → partially refunded → refunded.

## 9. Workers Free Compatibility

Workers Free: ~10 ms CPU per request, 100k requests/day, 128 MB memory, ~50 subrequests/request, 3 MB compressed bundle **[UNVERIFIED]**. CPU time does **not** include time spent waiting on the database or network.

| Workload | Estimate | Verdict |
|---|---|---|
| SSR of a React page | ~3–15 ms depending on page size **[estimate]** | **Borderline.** Mitigation: SSR only the shell. Data pages render client-side after hydration with skeletons. Measure in the staging deploy |
| Server function (auth check + SQL RPC) | ~1–3 ms CPU, the rest is I/O | OK |
| Supabase auth | JWT verification ~1 ms. Hashing happens on Supabase | OK |
| Self-managed auth (Neon option) | scrypt hashing at login ~50–100 ms+ **[estimate]** | **Exceeds Free.** Needs Workers Paid, or a weaker-cost hash (not recommended) |
| DB connections | Supabase: HTTPS (PostgREST/RPC), no pool needed. Neon: serverless HTTP driver | OK. No TCP pool on Workers |
| PDF | Generated in the browser | 0 server CPU |
| Bulk import (200–2,000 rows) | Parsed in the browser. Sent in chunks of ~200 rows to a validate/commit RPC. Validation runs in SQL | OK (CPU is in Postgres, not the Worker). Commit happens in staging tables, then one final SQL transaction |
| Backup | Runs in GitHub Actions, not the Worker | OK |
| Daily cron | One RPC call | OK |

Bundle size must stay under 3 MB: SheetJS and pdf-lib are lazy-loaded in the browser only.

**Plan:** build for Free, measure per-route CPU in staging (Cloudflare dashboard), and document Workers Paid as the fallback.

## 10. WhatsApp State Management (concurrency-safe)

- **content_version** increments on any bill_line insert (charge, bulk, room split, discount, adjustment, reversal) and on bill creation. Payments do **not** change it.
- **balance_version** increments whenever the outstanding amount changes (payment, reversal, application, line change).
- When opening WhatsApp, the client receives `{bill_id, version, message}`. The message is rendered from that version.
- **Mark as Sent** sends `{bill_id, type, sent_version}`. The server, in one statement:
  - `UPDATE notification_state SET last_sent_version = GREATEST(last_sent_version, sent_version)`, and inserts a log row with sent_version.
  - So marking an *older* version sent can never cover a newer one.
- If sent_version < current version, the UI warns: "Bill changed after this message was prepared. Share the updated bill." The button stays enabled.
- **Bill share enabled** when content_version > last_sent_version (bill).
- **Overdue reminder enabled** when today (IST) > due_date AND outstanding > 0 AND balance_version > last_sent_version (overdue).
  - Partial payment changes balance_version, so the reminder is enabled again, while unpaid.
  - Full payment makes outstanding 0, so it is disabled.
  - A new month going overdue is a separate bill and gets its own state.
- **Welcome:** enabled once after onboarding. The message uses only recorded payment amounts. Mark as Sent is logged, and resending is allowed from detail.
- Double-click on Mark as Sent is safe: GREATEST is idempotent. A duplicate log row for the same (bill, type, version, user within 10s) is ignored.
- UI never claims delivery: labels read "Marked as sent by X at time".

## 11. Editing and Audit Strategy

- Operational data (branches, rooms, beds, resident profile, due days, templates, permissions) is edited in place, with a `row_version` check ("changed by someone else, reload") and a trigger audit of before/after. A reason is required for rent, capacity and due-date changes.
- Financial data is append-only. Corrections happen through reversal lines, payment reversals, negative applications and deposit-entry reversals. The audit log shows the chain.
- Invariants are enforced in the database: no double bed, capacity ≥ occupancy, payable ≥ 0, 0 ≤ paid ≤ payable, credit ≥ 0, deposit held ≥ 0, refund paid ≤ refund due, one reversal per transaction/line, one bill per resident per month.
- Availability is only ever **Vacant / Occupied**, derived from allocations, never manually set.

## 12. Import, Export, Backup and Restore

**Import** (owner only)
- XLSX templates: Branches, Rooms, Beds, Residents + allocation, Deposits held, Opening balances (as of the migration date), Past payments (optional), Past charges (optional).
- Flow: upload, browser parse, chunked validation in staging tables (formats, duplicates by mobile/room/bed, bed conflicts, references, totals), preview with errors and a downloadable error report, then a single commit transaction.
- No past rent is generated. Opening balances become an `opening_balance` line on the migration-month bill. Past payments are imported as historical transactions marked `imported`.

**Exports:** every report as CSV/XLSX.

**Verified backup**
1. **Primary — scheduled `pg_dump`:**
   - A GitHub Actions workflow in the customer's private repo runs daily.
   - It runs `pg_dump --format=custom` of the app schema *and* the auth schema. On Supabase this is `auth.users` / identities. On Neon, the auth tables are in the app schema. The dump includes sequences and their current values.
   - The dump is encrypted with age/GPG (the key is held by the owner) and uploaded to the customer's R2 bucket with 30 daily and 12 monthly copies.
   - A manifest is written alongside it: per-table row counts, money checksums (Σ bill_lines, Σ transactions by direction, Σ applications, Σ deposit entries), sequence values, schema_version and sha256.
2. **Automatic verification (weekly):**
   - The same workflow restores the latest dump into a disposable scratch Postgres (a Postgres service container inside the Action).
   - It runs the verification SQL: counts and checksums match the manifest, all FK and constraint checks pass, ledger invariants hold, sequences are ≥ max(ids/numbers).
   - The result is written back to `backup_runs`. The dashboard shows "Last verified backup: date ✓ / ✗".
3. **Secondary — in-app backup** (owner button): a server-side SQL export of all app tables as JSON plus a manifest, downloaded as a file. Useful when GitHub isn't set up. It does **not** include auth password hashes, so the restore flow resets staff passwords.
4. **Restore runbook:**
   - Create an empty DB and run migrations to the backup's schema_version.
   - `pg_restore`, then reset sequences (`setval` from the manifest), then the verification SQL, then point the Worker env at it, then a smoke test (login, residents count, dashboard totals = manifest).
   - Roles, assignments and permissions restore with the data. Auth users restore from the dump, so passwords keep working.
5. **Restore drill:** at handover and quarterly, a documented checklist.

## 13. Implementation Sequence (complete release)

1. Provider decision. Staging environment. Design system, layout, navigation.
2. Migrations framework, audit trigger, append-only guards, invariant constraint triggers.
3. Auth, roles, branch assignments, permissions, RLS / SQL permission helpers.
4. Settings, branches, rooms (rent mode), beds, Vacant/Occupied views.
5. Residents, allocations, onboarding, search/filter.
6. Bills, due-date resolution, `ensure_bills`, cron + lazy trigger, discounts/adjustments.
7. Cash ledger: payments, applications, credit, reversals, deposit receipts.
8. Charges: individual, room-wise, bulk (month-overlap eligibility, preview, idempotency, fingerprint), reversals.
9. Residents central page with all columns, actions and the bulk toolbar.
10. Transfers, room reconfiguration, rent changes.
11. Checkout settlement, deposit deductions, pending/partial refunds, receipts (settlement, refund, payment PDFs).
12. WhatsApp templates, version state machine, notification log.
13. Dashboards, reports, exports.
14. Import engine.
15. Backup pipeline, verification workflow, in-app backup, restore runbook.
16. Audit viewer, staff management.
17. Tests (section 14), CPU measurement on Workers, accessibility and performance pass (1,000 residents).
18. Deployment script + runbook. First customer deploy plus a restore drill.

## 14. Testing Strategy

- **Unit:**
  - Rounding split (sum = T for random T, N).
  - Due-date resolution.
  - Settlement formula.
  - WhatsApp enable rules, including GREATEST behavior.
  - Template rendering.
  - Import validators.
- **Database:** each invariant has a failing-case test:
  - Double bed.
  - Paid > payable.
  - Negative credit.
  - Second reversal.
  - UPDATE on ledger.
  - Refund > due.
  - Capacity < occupancy.
  - Duplicate bill.
  - Duplicate idempotency key.
- **Ledger properties:** random sequences of payments, charges, reversals and refunds. After each step, all balances are recomputed from scratch and must equal the views and satisfy the invariants.
- **Authorization:**
  - A manager cannot reach another branch via the server function, the SQL function, or direct API.
  - Reversal without permission is rejected.
  - Staff-only permission matrix tests.
- **Concurrency** (parallel clients):
  - Two payments on one bill.
  - Two allocations of one bed.
  - Duplicate bulk submits.
  - Mark-as-Sent of v1 racing a charge creating v2: v2 stays enabled.
- **Scenario tests:** full lifecycles (mid-month join with discount, bulk EB including a checked-out resident, partial payments, overpayment credit, reversal, transfer with manual adjustment, checkout with deduction, two partial refunds), each checked against hand-computed values.
- **Backup:** dump, restore, verify in CI. Sequences continue correctly after restore (a new resident code doesn't collide).
- **End-to-end (Playwright, 360px + desktop):** onboarding, collection, bulk charge, share/re-enable, overdue, checkout, refund, PDFs, import.
- **Load:** CPU per route on Workers in staging.

## 15. Risks and Decisions Requiring Your Approval

**Decisions**
1. **Provider:** Supabase (recommended) or Neon + self-managed auth (needs Workers Paid budget).
2. **Backup storage target:** Cloudflare R2 (recommended), Google Drive, or the owner's machine. Plus who holds the encryption key.
3. **Room-split occupant rule** default: residents allocated to the room at any time in the month (equal split) vs only on a chosen date.
4. Charging a resident after a settled checkout: allowed as amount owed (proposed), or blocked?
5. Should overpayment credit auto-apply to new bills (proposed yes)?
6. Receipt number formats, and whether payment receipts are PDF and shareable on WhatsApp.
7. Data retention: mask checked-out residents' phone numbers after N years (propose 3)?
8. Password reset: Supabase email, or owner-resets-staff only?

**Risks**
- Free-tier terms can change (every quota above needs re-checking).
- Supabase inactivity pause.
- Workers Free CPU on SSR. Measure, with a $5 fallback.
- GitHub Actions/R2 setup per customer adds onboarding steps.
- WhatsApp delivery is unverifiable. Long bills may hit URL length limits; the message is truncated to a summary if more than ~1,500 characters.

## 16. Revised Acceptance Checklist

- [ ] All pages work at 360px and on desktop. Keyboard and labels pass an axe audit with no critical issues.
- [ ] Bed/room status shows only Vacant or Occupied, and occupancy shows as "x/y · n vacant".
- [ ] Capacity, room number, AC, rent mode/rent, resident details, due days, charges and templates are editable. Each edit appears in the audit log. An invalid capacity reduction is rejected.
- [ ] Cross-branch access is blocked at the UI, server and database (tests pass).
- [ ] A double bed allocation fails under concurrent requests.
- [ ] Running `ensure_bills` 5 times gives one bill per resident per month. Due date = resident override, else branch, else default.
- [ ] Ledger property tests: zero invariant violations over 10,000 random operations. Reports equal the recomputed balances.
- [ ] Reversal needs permission. A reversal is possible once only. Original records are untouched.
- [ ] Bulk ₹6,000 / 60 gives 60 × ₹100. ₹1,000 / 3 sums exactly. A double submit gives one batch. A resident checked out mid-month is selectable.
- [ ] WhatsApp: marking v1 sent while v2 exists leaves the button enabled. A payment does not re-enable bill share. Overdue is never enabled before the due date or at zero balance.
- [ ] Checkout releases the bed. The settlement PDF shows "Refund pending ₹X". After two partial refunds, the receipts show partially refunded, then refunded, with correct totals.
- [ ] Imported 3 branches / 200 residents: no past rent is generated. Errors are reported per row.
- [ ] Daily backup runs, and weekly verification restores to scratch with matching counts, checksums and sequences. A manual restore drill from the runbook succeeds, and staff can log in afterwards.
- [ ] Workers CPU per route measured in staging, within the plan limit, or a Paid plan approved.
- [ ] New customer deployment from the runbook takes under 1 hour with no code changes.
