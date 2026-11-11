# PG Manager — Client deployment and Antigravity handoff

## Architecture

- TanStack Start/React frontend and server functions: unchanged.
- **Neon PostgreSQL**: all PG data, users, sessions, ledger, document metadata and EB records.
- **Supabase Storage only**: private resident documents. Its database/auth are not used by this app.
- **Manual WhatsApp only**: opens a phone number and prefilled message. Confirmation is not delivery tracking.

Each client needs separate Neon and Supabase projects, a separate deployment and separate credentials. No services, migrations, credentials, GitHub pushes or deployments are created automatically by this handoff.

## Local configuration

Install Bun (https://bun.sh), then:

```sh
bun install --frozen-lockfile
cp .env.example .env
# Manually fill .env locally; never paste credentials into source.
bun run dev
```

The prepared local `.env` has blank values only and is already ignored by `.gitignore`. Ignored files may be omitted by Lovable/GitHub exports: recreate it from `.env.example` if absent.

| Variable | Required | Where to get it |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon → Connect → pooled PostgreSQL connection string, with SSL |
| `SUPABASE_URL` | Documents | Your storage project's HTTPS project URL |
| `SUPABASE_SECRET_KEY` | Documents | Supabase project API settings: server secret key (`sb_secret_…`) |
| `SUPABASE_STORAGE_BUCKET` | Documents | Name of the private bucket you create |

These are **server-only**, never `VITE_` variables. No `DIRECT_DATABASE_URL` is needed by this migration framework. Authentication uses PBKDF2 and database-backed 30-day httpOnly sessions; no `SESSION_SECRET`, JWT secret, email domain or password-reset email service is required. Password recovery uses the one-time owner code. Links use the current browser/request origin; no app URL environment variable is needed.

Production: put these same variables in the hosting service's protected environment settings, not an uploaded `.env`. Use HTTPS. Browser access never receives the database or storage key.

### Git safety

The existing `.gitignore` excludes `.env`, `.env.local`, `*.local`, `.dev.vars` and `.vercel`. Lovable manages this file and would not allow expanding it from chat. After export, manually add:

```gitignore
.env.*
!.env.example
.dev.vars.*
*.pem
*.key
```

Check `git check-ignore .env` before committing locally. Never commit credentials in differently named configuration files. `.env.example` must contain blank placeholders only.

## Explicit database migration commands

First take a backup and verify restore into an **isolated database**. Never test migrations against production first.

```sh
# Generate SQL files without contacting any database:
bun run db:schema

# Print/review only the new additive storage and EB statements:
bun run db:review

# Explicitly apply to the DATABASE_URL you configured, in one transaction:
bun run db:migrate

# For a NEW EMPTY client database only: install the complete schema:
bun run db:init
```

`db/final-changes.sql` is the focused additive migration; `db/schema.sql` is the complete schema. Neither deployment nor these review/generation commands apply migrations. The existing owner-only **Settings → General → Update database structure** remains an explicit manual alternative (it reapplies all idempotent statements). Setup initializes a new empty PG only after submission.

No existing API tables, message records, financial records or document references are dropped. Legacy API queue records remain dormant because the sender, webhook and scheduler endpoints no longer exist. Disable any old external scheduler and remove its callback subscriptions yourself. Remove obsolete `WHATSAPP_*` hosting variables manually; the app no longer reads them. Lovable-managed platform keys are not required for ordinary app operation.

## Private Supabase Storage setup

1. Create your own Supabase project for this client's **file storage only**. Do not move the Neon application database.
2. Storage → create a bucket, e.g. `resident-documents`; **Public bucket OFF**.
3. Set bucket maximum file size to **4 MB**. Allowed MIME types: `image/jpeg`, `image/png`, `application/pdf`.
4. Copy the HTTPS project URL, Supabase secret key (`SUPABASE_SECRET_KEY`, `sb_secret_…`) and bucket name into the variables above. Never use an anon/publishable key or client-exposed variable for the secret key field.
5. Do not add public/anonymous object policies. Access is mediated by the app's existing owner/staff session and assigned-branch checks. The privileged storage key stays server-side.
6. After applying the additive Neon migration, open a resident's **Guardian & ID → Private ID document** section. Upload after onboarding; JPEG/PNG/PDF files up to 4 MB are supported. Manual ID and uploaded ID are mutually exclusive: remove the existing proof before switching.
7. Verify upload, View, Download and Delete with invented documents in an isolated client test deployment, including staff denial outside assigned branches.

The app verifies bucket privacy and file signatures, generates random resident-specific object paths, stores metadata in Neon and authorizes every private action. Read/download links expire after **60 seconds**. Missing configuration shows a configuration-required message; unrelated PG work remains available. Delete first records durable pending intent: if storage or database completion fails, the document is shown as pending deletion and Delete can be retried; read links are blocked while cleanup is pending.

No R2 integration or stored R2 objects were found in source. Existing `id_doc_key` references without matching Supabase metadata are preserved and flagged for manual migration; no files are copied or deleted automatically. If any exist, inspect their previous storage owner/provider before migration. Keep the old location accessible until copy and metadata reconciliation have been verified.

## Room-wise electricity billing

- Rooms → select branch → room → **Electricity bill**; also accessible from Residents → Extra Charges → **Room-wise EB**. Both entry points open the same screen.
- Select service month and total EB → Calculate EB. Historical allocations include residents who checked out. Dates are inclusive. Multiple beds in the same room for the same resident/day are deduplicated. Each room is calculated independently for transfers (both recorded endpoints are inclusive).
- Daily room cost is total/month-day-count, divided among that day's residents. Exact rational calculation and largest-remainder rounding ensure all resident shares plus vacant-day owner cost equal the original amount in integer paise.
- Edit final shares; original, final and difference remain visible. No automatic redistribution. Overallocation must be fixed; underallocation needs explicit owner-borne approval. All-vacant room bills are entirely owner-borne unless manually adjusted for actual occupants.
- Save Draft is editable and does not create ledger lines. Finalize is immutable, version-checked, atomic and idempotent for the room/month. Historical changes after draft save require recalculation.
- Active resident charges follow the existing PG-wide charge-entry due rule (after due day → next month's bill); EB service month is preserved separately.
- Checked-out residents receive a **pending EB liability**, not a changed settlement. Owner may record a separate new post-checkout charge or bear the liability, with a reason and audit record. Existing rent, deposit, refund and payment records remain unchanged.

## Deploying on Vercel

Import the exported project into your own GitHub repository manually, then Vercel → Add New Project → import repository. Framework preset **Other**; existing `vercel.json` sets `npm run build` with `NITRO_PRESET=vercel`. Install dependencies with Bun or your configured package manager. Set the four server variables in Vercel's environment settings. Apply migrations explicitly before using new features. No migration command belongs in the deploy/build command.

## Antigravity and validation

Open the exported source folder in Antigravity. It contains routes, rules/tests, SQL, migration scripts, configuration templates and this guide. Exclude `.git`, dependencies and build outputs from source archives. Install dependencies locally, fill `.env`, run migrations against a separate test database, and run `bun run test` before continuing.

Before production, verify signed-in onboarding, room changes, checkout, bills/payments and document permissions against isolated data; test the actual private storage account and hosting variables. Mocked/isolated tests do not establish live storage delivery or production acceptance. Do not send real WhatsApp messages during testing unless explicitly intended.