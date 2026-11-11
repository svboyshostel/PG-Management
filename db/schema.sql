-- PG Manager schema. Apply explicitly after backup and review.
create extension if not exists pgcrypto;

create table if not exists settings (
    id int primary key default 1 check (id = 1),
    pg_name text not null default 'My PG',
    phone text default '',
    address text default '',
    default_due_day int not null default 5 check (default_due_day between 1 and 28),
    overdue_cooldown_days int not null default 3 check (overdue_cooldown_days between 1 and 60),
    tpl_welcome text not null default 'Hi {name}, welcome to {pg}! Your room is {room}, bed {bed}. Monthly rent: {rent}. Due on day {due_day} of each month.',
    tpl_bill text not null default 'Hi {name}, your bill for {month} at {pg} is {amount}. Due by {due_date}. Thank you!',
    tpl_overdue text not null default 'Hi {name}, a gentle reminder: {amount} is pending at {pg} (due {due_date}). Please pay at the earliest.'
  );

insert into settings (id) values (1) on conflict do nothing;

create table if not exists app_users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    full_name text not null,
    password_hash text not null,
    role text not null check (role in ('owner','staff')),
    can_reverse boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  );

create table if not exists sessions (
    token_hash text primary key,
    user_id uuid not null references app_users(id) on delete cascade,
    expires_at timestamptz not null
  );

alter table app_users add column if not exists recovery_code_hash text;

alter table app_users add column if not exists recovery_code_created_at timestamptz;

create table if not exists recovery_attempts (
    id bigserial primary key,
    email text not null,
    ok boolean not null default false,
    created_at timestamptz not null default now()
  );

create index if not exists recovery_attempts_recent on recovery_attempts (email, created_at);

create table if not exists branches (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    address text default '',
    due_day int check (due_day between 1 and 28),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  );

create table if not exists rooms (
    id uuid primary key default gen_random_uuid(),
    branch_id uuid not null references branches(id),
    room_number text not null,
    floor text default '',
    is_ac boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  );

create table if not exists staff_branches (
    user_id uuid not null references app_users(id) on delete cascade,
    branch_id uuid not null references branches(id),
    primary key (user_id, branch_id)
  );

create index if not exists staff_branches_branch on staff_branches(branch_id);

create unique index if not exists rooms_unique_active on rooms(branch_id, room_number) where is_active;

create table if not exists beds (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references rooms(id),
    label text not null,
    bed_rent bigint not null check (bed_rent >= 0),
    is_active boolean not null default true,
    unique (room_id, label)
  );

create sequence if not exists resident_code_seq start 1001;

create table if not exists residents (
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
  );

create index if not exists residents_mobile on residents(mobile);

create table if not exists allocations (
    id uuid primary key default gen_random_uuid(),
    resident_id uuid not null references residents(id),
    bed_id uuid not null references beds(id),
    start_date date not null,
    end_date date,
    monthly_rent bigint not null check (monthly_rent >= 0),
    created_at timestamptz not null default now(),
    check (end_date is null or end_date >= start_date)
  );

create unique index if not exists alloc_one_per_bed on allocations(bed_id) where end_date is null;

create unique index if not exists alloc_one_per_resident on allocations(resident_id) where end_date is null;

create table if not exists bills (
    id uuid primary key default gen_random_uuid(),
    resident_id uuid not null references residents(id),
    branch_id uuid not null references branches(id),
    billing_month date not null check (extract(day from billing_month) = 1),
    due_date date not null,
    created_at timestamptz not null default now(),
    unique (resident_id, billing_month)
  );

create table if not exists bill_lines (
    id uuid primary key default gen_random_uuid(),
    bill_id uuid not null references bills(id),
    kind text not null check (kind in ('rent','extra_charge','discount','adjustment','reversal')),
    description text not null,
    amount bigint not null,
    reason text default '',
    reverses_line_id uuid unique references bill_lines(id),
    created_by uuid references app_users(id),
    created_at timestamptz not null default now()
  );

create unique index if not exists one_rent_line_per_bill on bill_lines(bill_id) where kind = 'rent';

create table if not exists money_txns (
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
  );

create index if not exists money_txns_resident on money_txns(resident_id, txn_date);

create table if not exists notification_log (
    id uuid primary key default gen_random_uuid(),
    resident_id uuid not null references residents(id),
    bill_id uuid references bills(id),
    type text not null check (type in ('welcome','bill','overdue','other')),
    amount bigint,
    message_text text not null,
    marked_by uuid references app_users(id),
    marked_at timestamptz not null default now()
  );

alter table notification_log drop constraint if exists notification_log_type_check;

alter table notification_log add constraint notification_log_type_check check (type in ('welcome','bill','overdue','other'));

create or replace function block_mutation() returns trigger language plpgsql as $$
   begin raise exception 'Financial records are append-only (%). Add a reversal instead.', tg_table_name; end $$;

drop trigger if exists bill_lines_append_only on bill_lines;

create trigger bill_lines_append_only before update or delete on bill_lines for each row execute function block_mutation();

drop trigger if exists money_txns_append_only on money_txns;

create trigger money_txns_append_only before update or delete on money_txns for each row execute function block_mutation();

alter table settings add column if not exists due_window text not null default 'day';

alter table branches add column if not exists due_window text;

alter table settings add column if not exists timezone text not null default 'Asia/Kolkata';

alter table settings add column if not exists due_day_migrated boolean not null default false;

update settings set default_due_day = case when due_window = 'last_week' then 28 else 7 end, due_day_migrated = true where not due_day_migrated;

alter table residents add column if not exists guardian_name text not null default '';

alter table residents add column if not exists guardian_relation text not null default '';

alter table residents add column if not exists guardian_phone text not null default '';

alter table residents add column if not exists id_method text check (id_method in ('manual','upload'));

alter table residents add column if not exists id_type text;

alter table residents add column if not exists id_number text;

alter table residents add column if not exists id_doc_key text;

alter table residents add column if not exists id_verification text not null default 'pending' check (id_verification in ('pending','verified','rejected'));

alter table residents drop constraint if exists residents_id_exclusive;

alter table residents add constraint residents_id_exclusive check (not (id_number is not null and id_doc_key is not null));

alter table bill_lines add column if not exists entry_date date not null default current_date;

alter table bill_lines add column if not exists service_month date;

alter table bill_lines add column if not exists category text;

alter table app_users add column if not exists can_message boolean not null default true;

alter table app_users alter column can_message set default false;

create table if not exists wa_templates (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text not null,
    category text not null default 'custom',
    status text not null default 'active' check (status in ('active','inactive','archived')),
    created_by uuid references app_users(id),
    updated_by uuid references app_users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

alter table notification_log add column if not exists template_id uuid references wa_templates(id);

alter table notification_log add column if not exists template_title text;

create table if not exists wa_template_audit (
    id uuid primary key default gen_random_uuid(),
    template_id uuid not null references wa_templates(id),
    action text not null,
    title text not null,
    body text not null,
    status text not null,
    by_user uuid references app_users(id),
    at timestamptz not null default now()
  );

create table if not exists wa_send_sessions (
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
  );

create table if not exists wa_send_recipients (
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
  );

create index if not exists wa_recipients_resident on wa_send_recipients(resident_id, status);

create table if not exists resident_documents (
    id uuid primary key default gen_random_uuid(),resident_id uuid not null references residents(id),
    provider text not null default 'supabase',bucket text not null,object_key text not null unique,
    file_name text not null,mime_type text not null,size_bytes int not null constraint resident_documents_size_limit check(size_bytes between 1 and 4194304),
    created_by uuid references app_users(id),created_at timestamptz not null default now(),deleted_at timestamptz);

create index if not exists resident_documents_resident on resident_documents(resident_id) where deleted_at is null;

alter table resident_documents add column if not exists delete_pending_at timestamptz;

do $$ declare c record; begin
    if not exists (select 1 from pg_constraint where conrelid = 'resident_documents'::regclass and conname = 'resident_documents_size_limit') then
      for c in select conname from pg_constraint where conrelid = 'resident_documents'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%size_bytes%' loop
        execute format('alter table resident_documents drop constraint %I', c.conname);
      end loop;
      alter table resident_documents add constraint resident_documents_size_limit
        check (size_bytes between 1 and 4194304 or (size_bytes between 4194305 and 5242880 and (deleted_at is not null or delete_pending_at is not null))) not valid;
    end if;
  end $$;

create table if not exists room_eb_bills (
    id uuid primary key default gen_random_uuid(), room_id uuid not null references rooms(id),
    billing_month date not null check (extract(day from billing_month)=1), total bigint not null check (total>=0),
    owner_amount bigint not null default 0 check (owner_amount>=0), owner_accepted boolean not null default false,
    status text not null default 'draft' check (status in ('draft','finalized')), version int not null default 1,
    occupancy jsonb not null default '[]', shares jsonb not null default '[]',
    created_by uuid references app_users(id), updated_by uuid references app_users(id),
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(), finalized_at timestamptz,
    unique(room_id,billing_month));

create table if not exists room_eb_liabilities (
    id uuid primary key default gen_random_uuid(), eb_id uuid not null references room_eb_bills(id),
    resident_id uuid not null references residents(id), amount bigint not null check (amount>=0),
    state text not null check (state in ('posted','pending','owner_borne')), line_id uuid references bill_lines(id),
    reason text, resolved_by uuid references app_users(id), resolved_at timestamptz,
    unique(eb_id,resident_id));

create table if not exists room_eb_audit (
    id bigserial primary key, eb_id uuid not null references room_eb_bills(id), action text not null,
    snapshot jsonb not null, by_user uuid references app_users(id), at timestamptz not null default now());

create or replace function guard_final_eb() returns trigger language plpgsql as $$
    begin if old.status='finalized' then raise exception 'Finalized electricity bills are immutable'; end if; return new; end $$;

drop trigger if exists room_eb_immutable on room_eb_bills;

create trigger room_eb_immutable before update or delete on room_eb_bills for each row execute function guard_final_eb();

create or replace function finalize_room_eb(p_id uuid,p_version int,p_user uuid,p_month date,p_today date,p_due int) returns void language plpgsql as $$
    declare eb room_eb_bills; sh jsonb; rid uuid; bid uuid; lid uuid; allocated bigint; current_occ jsonb; resident_status text;
    begin
      if not exists(select 1 from app_users where id=p_user and role='owner' and is_active) then raise exception 'Only the owner can finalize EB'; end if;
      select * into eb from room_eb_bills where id=p_id for update;
      if not found then raise exception 'EB bill not found'; end if;
      if eb.status='finalized' then return; end if;
      if eb.version<>p_version then raise exception 'Draft changed. Reload it.'; end if;
      select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'resident_id',a.resident_id,'name',r.name,'start_date',a.start_date::text,'end_date',a.end_date::text,'status',r.status) order by a.id),'[]') into current_occ
        from allocations a join beds b on b.id=a.bed_id join residents r on r.id=a.resident_id
        where b.room_id=eb.room_id and a.start_date<eb.billing_month+interval '1 month' and (a.end_date is null or a.end_date>=eb.billing_month);
      if current_occ<>eb.occupancy then raise exception 'Occupancy changed. Calculate EB again.'; end if;
      select coalesce(sum((x->>'final')::bigint),0) into allocated from jsonb_array_elements(eb.shares) x;
      if allocated>eb.total or allocated<0 or (allocated<eb.total and not eb.owner_accepted) then raise exception 'Reconcile owner-borne difference'; end if;
      for sh in select * from jsonb_array_elements(eb.shares) loop
        rid=(sh->>'residentId')::uuid;
        select status into resident_status from residents where id=rid for update;
        if (sh->>'final')::bigint<0 then raise exception 'Negative share'; end if;
        lid=null;
        if resident_status='active' and (sh->>'final')::bigint>0 then
          insert into bills(resident_id,branch_id,billing_month,due_date)
          select r.id,rm.branch_id,p_month,case when r.joining_date>p_month+(p_due-1) then (p_month+interval '1 month')::date+(p_due-1) else p_month+(p_due-1) end
          from residents r join rooms rm on rm.id=eb.room_id where r.id=rid on conflict(resident_id,billing_month) do nothing;
          select id into bid from bills where resident_id=rid and billing_month=p_month;
          insert into bill_lines(bill_id,kind,description,amount,reason,created_by,entry_date,service_month,category)
          values(bid,'extra_charge','Room electricity — '||to_char(eb.billing_month,'Mon YYYY'),(sh->>'final')::bigint,'Room EB '||eb.id,p_user,p_today,eb.billing_month,'electricity') returning id into lid;
        end if;
        insert into room_eb_liabilities(eb_id,resident_id,amount,state,line_id)
          values(eb.id,rid,(sh->>'final')::bigint,case when resident_status='checked_out' and (sh->>'final')::bigint>0 then 'pending' else 'posted' end,lid);
      end loop;
      update room_eb_bills set status='finalized',owner_amount=total-allocated,finalized_at=now(),updated_at=now(),updated_by=p_user where id=eb.id;
      insert into room_eb_audit(eb_id,action,snapshot,by_user) values(eb.id,'finalized',to_jsonb(eb),p_user);
    end $$;

insert into wa_templates (title, body, category)
   select v.t, v.b, v.c from (values
     ('Rent Reminder', E'Hi {name},

Your {month} payment details for {pg}:

{bill_breakdown}

Kindly complete the pending payment.

Thank you,
{pg}', 'rent'),
     ('Overdue Payment', E'Hi {name}, a gentle reminder: {balance} is pending at {pg} (due {due_date}). Please pay at the earliest.

{bill_breakdown}', 'overdue'),
     ('Pending Deposit', E'Hi {name}, your security deposit balance at {pg} is {deposit_balance}. Please pay it at the earliest. Thank you!', 'deposit'),
     ('General Announcement', E'Hi {name}, an update from {pg}: ', 'announcement')
   ) v(t,b,c) where not exists (select 1 from wa_templates);
