# PG Manager

Manage PG branches, rooms, beds, residents, monthly rent bills, payments, deposits, checkouts and WhatsApp reminders.

## 1. Connect your Neon database (2 minutes)

1. Create a free project at https://console.neon.tech.
2. Click **Connect** and copy the **pooled** connection string (`postgresql://…-pooler…/neondb?sslmode=require`).
3. Add it as an environment variable named **`DATABASE_URL`**:
   - **Lovable preview:** ask in chat to add the `DATABASE_URL` secret.
   - **Vercel:** Project → Settings → Environment Variables.
   - **Local:** copy `.env.example` to `.env`.
4. Open the app. The **Setup** screen creates all tables automatically and asks for your PG name and owner login.

(Optional) The full schema is also in `db/schema.sql` if you prefer to run it in Neon's SQL editor.

## 2. Deploy to Vercel via GitHub

1. In Lovable, connect GitHub (top-right **GitHub → Connect**) and create the repository.
2. On https://vercel.com → **Add New → Project** → import that repository.
3. Framework preset: **Other**. Build command `npm run build` (already in `vercel.json`, which also sets `NITRO_PRESET=vercel`).
4. Add `DATABASE_URL` under Environment Variables → **Deploy**.
5. Every push to GitHub (including edits made in Lovable) redeploys automatically.

After an app update that changes the database, open **Settings → General → Update database structure** once.

## 3. Forgotten owner password

No email is needed. During setup the owner gets a one-time **recovery code** (shown once — save it).
On sign-in, **Forgot password?** asks for the owner email, that code and a new password. After a reset all
devices are signed out, the old code stops working and a new code is shown once. Existing owners can create a
code in **Settings → Security** (needs the current password). Five wrong tries lock the form for 15 minutes.
Staff passwords are reset by the owner in **Settings → Staff**.

## Rules built in


- Money is stored in integer paise. Bills and payments are never edited or deleted — corrections are reversal entries.
- Rent is set per bed (and can be changed per resident). Calendar-month billing, no proration.
- Bills are created automatically for everyone who occupied a bed during the month (one per resident per month).
- Payments apply to the oldest bill first; extra becomes advance credit.
- The owner resets a forgotten password with a recovery code (no email); the owner sets new passwords for staff. No resident login.
- WhatsApp: click-to-chat with editable templates, then **Mark as sent**. Overdue reminders respect a gap the owner sets.

## Develop locally

```bash
npm install
npm run dev
```

## Phase 4 operations

- Review [the additive migration](docs/phase4-migration.md) before updating a database. Assign each staff member one or more branches; no assignment means no access. New staff do not have WhatsApp permission unless enabled explicitly.
- For a private client demo, create a separate empty Neon database, configure its own `DATABASE_URL` on a separate deployment, and run Setup there with an invented owner account. Never copy production resident records. No demo is created automatically.
- WhatsApp is manual sharing only. API senders, configuration, webhooks and queue runners have been removed. Historical automated records remain read-only. Remove obsolete external schedulers, subscriptions and hosting credentials manually.
- Before production, export a backup using a trusted PostgreSQL client, restore into a **separate empty database**, and verify counts, immutable ledger sums, login, resident history and totals. A backup without a successful restore check is not verified. Backup and Vercel deployment are not executed by Phase 4.

## Final client handoff

See [CLIENT_DEPLOYMENT.md](CLIENT_DEPLOYMENT.md) for blank environment variables, private Supabase Storage configuration, explicit Neon migration commands, room-wise electricity billing, Git safety and Antigravity instructions. No production migration or deployment is automatic. Existing audit/phase documents describe historical versions; the client handoff guide is authoritative for the current manual-only messaging architecture.
