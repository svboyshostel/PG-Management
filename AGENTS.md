<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Database: Neon Postgres via `@neondatabase/serverless` (HTTP) reading `DATABASE_URL` in `src/lib/db.server.ts` — portable across Lovable hosting, Cloudflare and Vercel without the Lovable gateway.
- Schema lives in `src/lib/schema.ts` as idempotent statements (applied by the Setup screen / "Update database structure"); regenerate `db/schema.sql` from it when it changes.
- Auth is self-contained (PBKDF2 hashes + httpOnly session cookie in `sessions` table, `src/lib/auth.server.ts`); every server function calls `requireUser`/`requireOwner` first.
- Ledger balances are derived, never stored: bill payable = sum of bill_lines; payments are applied oldest-first in code (`applyFifo`). bill_lines and money_txns are append-only (DB trigger).
- Vercel builds use `NITRO_PRESET=vercel` (vercel.json); Lovable builds stay on its default preset.
- Pure business rules (due dates, charge month, capacity plans, deposit status, ID proof, bill breakdown) live in `src/lib/rules.ts` with tests in `rules.test.ts`; server functions call them so rules stay testable without a database.
- Server "today" uses the PG timezone from `settings.timezone` (`todayPg()` in pg.functions.ts), never the server clock.
- WhatsApp uses manual sessions with rendered snapshots; legacy automated sessions are read-only to preserve history without running automation. Recipient updates are guarded; manual "sent" requires "opened".
- One WhatsApp template list: `wa_templates` is the only message-template store. The per-resident quick send (`markSent`) picks from it and logs to `notification_log` with `template_id`/`template_title`; the log type comes from the template category via `logTypeForCategory` in `wa.ts`, only `overdue` sends obey `settings.overdue_cooldown_days`, and that gap is edited on the WhatsApp settings screen — PG Settings holds no message fields.
- Documents use server-authorized private Supabase Storage REST requests; Neon stores metadata so primary data and sessions stay portable. Bucket privacy, signatures and limits are checked before uploads; signed reads expire quickly.
- Room electricity rules are pure in `eb.ts`; versioned drafts and atomic PostgreSQL finalization prevent duplicate charges. Checked-out shares become separately reconciled liabilities, never settlement rewrites.
- Explicit Bun migration commands review SQL without connecting by default; only --apply changes a database, so deploys cannot silently migrate production.
- Branch access uses staff_branches plus server-side entity guards and bound query scopes; an empty staff scope denies access, and mixed-branch WhatsApp sessions require access to every recipient to prevent history leaks.
- Owner password recovery uses a one-time recovery code, no email: only its SHA-256 hash (salted with the user id) lives on `app_users`; reset is an atomic compare-and-swap that rotates the code and deletes sessions; failed tries are counted in `recovery_attempts` before checking (per-email and global limits). Rules in `src/lib/reset.ts`.

