// Additive only. Finalized EB records are immutable; checkout liabilities are reconciled separately.
export const EB_SCHEMA_STATEMENTS = [
  `create table if not exists room_eb_bills (
    id uuid primary key default gen_random_uuid(), room_id uuid not null references rooms(id),
    billing_month date not null check (extract(day from billing_month)=1), total bigint not null check (total>=0),
    owner_amount bigint not null default 0 check (owner_amount>=0), owner_accepted boolean not null default false,
    status text not null default 'draft' check (status in ('draft','finalized')), version int not null default 1,
    occupancy jsonb not null default '[]', shares jsonb not null default '[]',
    created_by uuid references app_users(id), updated_by uuid references app_users(id),
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(), finalized_at timestamptz,
    unique(room_id,billing_month))`,
  `create table if not exists room_eb_liabilities (
    id uuid primary key default gen_random_uuid(), eb_id uuid not null references room_eb_bills(id),
    resident_id uuid not null references residents(id), amount bigint not null check (amount>=0),
    state text not null check (state in ('posted','pending','owner_borne')), line_id uuid references bill_lines(id),
    reason text, resolved_by uuid references app_users(id), resolved_at timestamptz,
    unique(eb_id,resident_id))`,
  `create table if not exists room_eb_audit (
    id bigserial primary key, eb_id uuid not null references room_eb_bills(id), action text not null,
    snapshot jsonb not null, by_user uuid references app_users(id), at timestamptz not null default now())`,
  `create or replace function guard_final_eb() returns trigger language plpgsql as $$
    begin if old.status='finalized' then raise exception 'Finalized electricity bills are immutable'; end if; return new; end $$`,
  `drop trigger if exists room_eb_immutable on room_eb_bills`,
  `create trigger room_eb_immutable before update or delete on room_eb_bills for each row execute function guard_final_eb()`,
  `create or replace function finalize_room_eb(p_id uuid,p_version int,p_user uuid,p_month date,p_today date,p_due int) returns void language plpgsql as $$
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
    end $$`,
];