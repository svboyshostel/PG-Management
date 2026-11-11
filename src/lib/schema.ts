import { EB_SCHEMA_STATEMENTS } from "./eb-schema";
import { DOCUMENT_SCHEMA_STATEMENTS } from "./documents-schema";
// Idempotent schema. Applied from the in-app Setup screen (or paste db/schema.sql into Neon's SQL editor).
// Money is integer paise (bigint). Financial tables (bill_lines, money_txns) are append-only.
export const SCHEMA_STATEMENTS: string[] = [
  `create extension if not exists pgcrypto`,
  `create table if not exists settings (
    id int primary key default 1 check (id = 1),
    pg_name text not null default 'My PG',
    phone text default '',
    address text default '',
    default_due_day int not null default 5 check (default_due_day between 1 and 28),
    overdue_cooldown_days int not null default 3 check (overdue_cooldown_days between 1 and 60),
    tpl_welcome text not null default 'Hi {name}, welcome to {pg}! Your room is {room}, bed {bed}. Monthly rent: {rent}. Due on day {due_day} of each month.',
    tpl_bill text not null default 'Hi {name}, your bill for {month} at {pg} is {amount}. Due by {due_date}. Thank you!',
    tpl_overdue text not null default 'Hi {name}, a gentle reminder: {amount} is pending at {pg} (due {due_date}). Please pay at the earliest.'
  )`,
  `insert into settings (id) values (1) on conflict do nothing`,
  `create table if not exists app_users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    full_name text not null,
    password_hash text not null,
    role text not null check (role in ('owner','staff')),
    can_reverse boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists sessions (
    token_hash text primary key,
    user_id uuid not null references app_users(id) on delete cascade,
    expires_at timestamptz not null
  )`,
  `alter table app_users add column if not exists recovery_code_hash text`,
  `alter table app_users add column if not exists recovery_code_created_at timestamptz`,
  `create table if not exists recovery_attempts (
    id bigserial primary key,
    email text not null,
    ok boolean not null default false,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists recovery_attempts_recent on recovery_attempts (email, created_at)`,

  `create table if not exists branches (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    address text default '',
    due_day int check (due_day between 1 and 28),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists rooms (
    id uuid primary key default gen_random_uuid(),
    branch_id uuid not null references branches(id),
    room_number text not null,
    floor text default '',
    is_ac boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  )`,
  // Phase 4: additive access migration; existing staff receive NO assignments automatically.
  `create table if not exists staff_branches (
    user_id uuid not null references app_users(id) on delete cascade,
    branch_id uuid not null references branches(id),
    primary key (user_id, branch_id)
  )`,
  `create index if not exists staff_branches_branch on staff_branches(branch_id)`,
  `create unique index if not exists rooms_unique_active on rooms(branch_id, room_number) where is_active`,
  `create table if not exists beds (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references rooms(id),
    label text not null,
    bed_rent bigint not null check (bed_rent >= 0),
    is_active boolean not null default true,
    unique (room_id, label)
  )`,
  `create sequence if not exists resident_code_seq start 1001`,
  `create table if not exists residents (
    id uuid primary key default gen_random_uuid(),
    code text not null unique default ('R' || nextval('resident_code_seq')),
    name text not null,
    mobile text not null,
    alt_mobile text default '',
    branch_id uuid not null references branches(id),
    status text not null default 'active' check (status in ('active','checked_out')),
    joining_date date not null,
    checkout_date date,
    due_day_override int check (due_day_override between 1 and 28),
    deposit_agreed bigint not null default 0 check (deposit_agreed >= 0),
    notes text default '',
    created_at timestamptz not null default now()
  )`,
  `create index if not exists residents_mobile on residents(mobile)`,
  `create table if not exists allocations (
    id uuid primary key default gen_random_uuid(),
    resident_id uuid not null references residents(id),
    bed_id uuid not null references beds(id),
    start_date date not null,
    end_date date,
    monthly_rent bigint not null check (monthly_rent >= 0),
    created_at timestamptz not null default now(),
    check (end_date is null or end_date >= start_date)
  )`,
  `create unique index if not exists alloc_one_per_bed on allocations(bed_id) where end_date is null`,
  `create unique index if not exists alloc_one_per_resident on allocations(resident_id) where end_date is null`,
  `create table if not exists bills (
    id uuid primary key default gen_random_uuid(),
    resident_id uuid not null references residents(id),
    branch_id uuid not null references branches(id),
    billing_month date not null check (extract(day from billing_month) = 1),
    due_date date not null,
    created_at timestamptz not null default now(),
    unique (resident_id, billing_month)
  )`,
  `create table if not exists bill_lines (
    id uuid primary key default gen_random_uuid(),
    bill_id uuid not null references bills(id),
    kind text not null check (kind in ('rent','extra_charge','discount','adjustment','reversal')),
    description text not null,
    amount bigint not null,
    reason text default '',
    reverses_line_id uuid unique references bill_lines(id),
    created_by uuid references app_users(id),
    created_at timestamptz not null default now()
  )`,
  `create unique index if not exists one_rent_line_per_bill on bill_lines(bill_id) where kind = 'rent'`,
  `create table if not exists money_txns (
    id uuid primary key default gen_random_uuid(),
    resident_id uuid not null references residents(id),
    direction text not null check (direction in ('in','out')),
    account text not null check (account in ('rent','deposit')),
    purpose text not null check (purpose in ('rent_payment','deposit_receipt','deposit_refund','deposit_deduction','deposit_to_dues','credit_refund','reversal')),
    amount bigint not null check (amount > 0),
    method text not null check (method in ('cash','upi','bank','internal')),
    reference text default '',
    note text default '',
    txn_date date not null,
    reverses_txn_id uuid unique references money_txns(id),
    idempotency_key text unique,
    created_by uuid references app_users(id),
    created_at timestamptz not null default now()
  )`,
  `create index if not exists money_txns_resident on money_txns(resident_id, txn_date)`,
  `create table if not exists notification_log (
    id uuid primary key default gen_random_uuid(),
    resident_id uuid not null references residents(id),
    bill_id uuid references bills(id),
    type text not null check (type in ('welcome','bill','overdue','other')),
    amount bigint,
    message_text text not null,
    marked_by uuid references app_users(id),
    marked_at timestamptz not null default now()
  )`,
  // Quick sends now come from the shared wa_templates list, so any category must be loggable.
  `alter table notification_log drop constraint if exists notification_log_type_check`,
  `alter table notification_log add constraint notification_log_type_check check (type in ('welcome','bill','overdue','other'))`,
  `create or replace function block_mutation() returns trigger language plpgsql as $$
   begin raise exception 'Financial records are append-only (%). Add a reversal instead.', tg_table_name; end $$`,
  `drop trigger if exists bill_lines_append_only on bill_lines`,
  `create trigger bill_lines_append_only before update or delete on bill_lines for each row execute function block_mutation()`,
  `drop trigger if exists money_txns_append_only on money_txns`,
  `create trigger money_txns_append_only before update or delete on money_txns for each row execute function block_mutation()`,
  `alter table settings add column if not exists due_window text not null default 'day'`,
  `alter table branches add column if not exists due_window text`,
  // Phase 1: single PG-wide due day (1–28) + timezone. One-time carry-over from the old first/last-week setting.
  `alter table settings add column if not exists timezone text not null default 'Asia/Kolkata'`,
  `alter table settings add column if not exists due_day_migrated boolean not null default false`,
  `update settings set default_due_day = case when due_window = 'last_week' then 28 else 7 end, due_day_migrated = true where not due_day_migrated`,
  // Phase 1: guardian + ID proof (Aadhaar stored masked only).
  `alter table residents add column if not exists guardian_name text not null default ''`,
  `alter table residents add column if not exists guardian_relation text not null default ''`,
  `alter table residents add column if not exists guardian_phone text not null default ''`,
  `alter table residents add column if not exists id_method text check (id_method in ('manual','upload'))`,
  `alter table residents add column if not exists id_type text`,
  `alter table residents add column if not exists id_number text`,
  `alter table residents add column if not exists id_doc_key text`,
  `alter table residents add column if not exists id_verification text not null default 'pending' check (id_verification in ('pending','verified','rejected'))`,
  `alter table residents drop constraint if exists residents_id_exclusive`,
  `alter table residents add constraint residents_id_exclusive check (not (id_number is not null and id_doc_key is not null))`,
  // Phase 1: charge entry date, service month and category (bill's billing_month is the allocated month).
  `alter table bill_lines add column if not exists entry_date date not null default current_date`,
  `alter table bill_lines add column if not exists service_month date`,
  `alter table bill_lines add column if not exists category text`,
  // Phase 2: WhatsApp Message Center. Sessions/recipients keep a rendered snapshot so template edits never change history.
  `alter table app_users add column if not exists can_message boolean not null default true`,
  `alter table app_users alter column can_message set default false`,
  `create table if not exists wa_templates (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text not null,
    category text not null default 'custom',
    status text not null default 'active' check (status in ('active','inactive','archived')),
    created_by uuid references app_users(id),
    updated_by uuid references app_users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  // The per-resident quick send logs which shared template it used (added after wa_templates exists).
  `alter table notification_log add column if not exists template_id uuid references wa_templates(id)`,
  `alter table notification_log add column if not exists template_title text`,
  `create table if not exists wa_template_audit (
    id uuid primary key default gen_random_uuid(),
    template_id uuid not null references wa_templates(id),
    action text not null,
    title text not null,
    body text not null,
    status text not null,
    by_user uuid references app_users(id),
    at timestamptz not null default now()
  )`,
  `create table if not exists wa_send_sessions (
    id uuid primary key default gen_random_uuid(),
    template_id uuid references wa_templates(id),
    template_title text not null,
    billing_month date,
    branch_id uuid references branches(id),
    recipient_category text not null,
    filters jsonb not null default '{}',
    method text not null default 'MANUAL_WHATSAPP' check (method in ('MANUAL_WHATSAPP','WHATSAPP_CLOUD_API')),
    status text not null default 'active' check (status in ('active','paused','completed')),
    idempotency_key text unique,
    created_by uuid references app_users(id),
    created_at timestamptz not null default now()
  )`,
  `create table if not exists wa_send_recipients (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references wa_send_sessions(id),
    resident_id uuid not null references residents(id),
    position int not null,
    wa_number text not null,
    message_text text not null,
    outstanding bigint,
    status text not null default 'pending' check (status in ('pending','opened','sent','skipped','failed','queued','submitted','accepted','delivered','read')),
    provider_message_id text,
    error text,
    updated_by uuid references app_users(id),
    updated_at timestamptz not null default now(),
    sent_at timestamptz,
    unique (session_id, resident_id)
  )`,
  `create index if not exists wa_recipients_resident on wa_send_recipients(resident_id, status)`,
  // Legacy automation schema is intentionally not recreated or dropped. Existing history remains readable.
  ...DOCUMENT_SCHEMA_STATEMENTS,
  ...EB_SCHEMA_STATEMENTS,
  `insert into wa_templates (title, body, category)
   select v.t, v.b, v.c from (values
     ('Rent Reminder', E'Hi {name},\n\nYour {month} payment details for {pg}:\n\n{bill_breakdown}\n\nKindly complete the pending payment.\n\nThank you,\n{pg}', 'rent'),
     ('Overdue Payment', E'Hi {name}, a gentle reminder: {balance} is pending at {pg} (due {due_date}). Please pay at the earliest.\n\n{bill_breakdown}', 'overdue'),
     ('Pending Deposit', E'Hi {name}, your security deposit balance at {pg} is {deposit_balance}. Please pay it at the earliest. Thank you!', 'deposit'),
     ('General Announcement', E'Hi {name}, an update from {pg}: ', 'announcement')
   ) v(t,b,c) where not exists (select 1 from wa_templates)`,
];
