export const DOCUMENT_SCHEMA_STATEMENTS = [
  `create table if not exists resident_documents (
    id uuid primary key default gen_random_uuid(),resident_id uuid not null references residents(id),
    provider text not null default 'supabase',bucket text not null,object_key text not null unique,
    file_name text not null,mime_type text not null,size_bytes int not null constraint resident_documents_size_limit check(size_bytes between 1 and 4194304),
    created_by uuid references app_users(id),created_at timestamptz not null default now(),deleted_at timestamptz)`,
  `create index if not exists resident_documents_resident on resident_documents(resident_id) where deleted_at is null`,
  `alter table resident_documents add column if not exists delete_pending_at timestamptz`,
  `do $$ declare c record; begin
    if not exists (select 1 from pg_constraint where conrelid = 'resident_documents'::regclass and conname = 'resident_documents_size_limit') then
      for c in select conname from pg_constraint where conrelid = 'resident_documents'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%size_bytes%' loop
        execute format('alter table resident_documents drop constraint %I', c.conname);
      end loop;
      alter table resident_documents add constraint resident_documents_size_limit
        check (size_bytes between 1 and 4194304 or (size_bytes between 4194305 and 5242880 and (deleted_at is not null or delete_pending_at is not null))) not valid;
    end if;
  end $$`,
];