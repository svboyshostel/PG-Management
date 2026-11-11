# Phase 4 additive migration — review before applying

The application continues to use the existing customer-owned Neon database and portable HTTP driver. No gateway or provider change is required.

## New statements

- `staff_branches(user_id, branch_id)` with a composite primary key and foreign keys to existing users and branches.
- Index on `staff_branches.branch_id`.
- Change the default of `app_users.can_message` to false for future staff accounts. Existing explicit permission values are preserved.

No staff are assigned automatically. Existing staff are denied branch access until an owner assigns one or more branches. Existing owner access is unchanged. No financial tables, bill amounts, due dates, resident records, counters or message history are modified by these new statements.

## Applying

Review this document first. On an isolated Neon branch/database, apply the generated `db/schema.sql` or use Settings → General → Update database structure, then assign staff under Settings → Staff. Verify owner access, staff access, and an unassigned account before applying to the client database. The update button reruns the application's older idempotent migrations as well; it is not a Phase-4-only migration.

Phase 4 does not automatically apply this migration to the existing database. The isolated PostgreSQL test suite applies it twice and confirms existing fixture rows survive.