-- =====================================================================
--  CFLandGlide — database setup
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  It is safe to run again later (it will not delete any data).
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 1 — WHO CAN USE THE APP
-- Only emails listed here can see or change anything, even if someone
-- else manages to create a login. Put the email YOU will log in with.
-- (More people can be added later inside the app: Settings → Team.)
-- ---------------------------------------------------------------------
create table if not exists public.app_members (
  email        text primary key check (email = lower(email)),
  display_name text not null,
  added_at     timestamptz not null default now(),
  added_by     text
);

insert into public.app_members (email, display_name, added_by)
values ('your.email@example.com', 'Your name', 'setup')   -- ← change both before running
on conflict (email) do nothing;

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_members m
    where m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.current_member_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select display_name from public.app_members
      where email = lower(coalesce(auth.jwt() ->> 'email', ''))),
    auth.jwt() ->> 'email',
    'system');
$$;

-- ---------------------------------------------------------------------
-- TABLES
-- Each property-level table keeps `source_values`: the original values
-- from the research document. They can never be changed or deleted.
-- Edits change the normal columns; every change is written to audit_log.
-- ---------------------------------------------------------------------
create table if not exists public.properties (
  id                        text primary key,           -- account number for source records
  record_no                 int,
  record_type               text not null default 'property'
                              check (record_type in ('property','unidentified','manual')),
  account_number            text unique,
  parcel_number             text,
  account_number_as_written text,
  address_line              text,
  city                      text,
  state                     text,
  zip                       text,
  site_address_as_written   text,
  address_status            text not null default 'none'
                              check (address_status in ('exact','street_only','none','disputed','manual')),
  location_status           text not null default 'not_located'
                              check (location_status in ('exact_confirmed','parcel_located','needs_verification',
                                                         'not_confirmed','not_located','manual')),
  lat                       double precision,
  lng                       double precision,
  geometry                  jsonb,
  location_source           text,
  location_checked_at       timestamptz,
  property_type             text,
  property_type_group       text,
  acreage                   numeric,
  land_sqft                 numeric,
  building_sqft             numeric,
  bedrooms                  numeric,
  bathrooms                 numeric,
  assessed_value            numeric,
  assessed_value_label      text,
  estimated_value           numeric,
  estimated_value_label     text,
  last_sale_date            date,
  last_sale_price           numeric,
  status                    text not null default 'New',
  contacted                 boolean not null default false,
  follow_up_date            date,
  verification_status       text not null default 'Unverified',
  reviewed                  boolean not null default false,
  reviewed_at               timestamptz,
  reviewed_by_name          text,
  research_notes            text,
  source_pages              text,
  source_ref                text,
  source_notes              jsonb not null default '[]'::jsonb,
  source_links              jsonb not null default '[]'::jsonb,
  source_values             jsonb,
  archived                  boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  created_by_name           text,
  updated_by_name           text
);

create table if not exists public.owners (
  id                        text primary key,
  property_id               text not null references public.properties(id) on delete restrict,
  owner_name                text,
  ownership_entity          text,
  registered_agent          text,
  registered_agent_address  text,
  trustee                   text,
  mailing_address           text,
  phones_listed_for         text,
  phones_listed_for_age     int,
  owner_age_in_source       int,
  summary_owner_name        text,
  source_ref                text,
  source_values             jsonb,
  archived                  boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  created_by_name           text,
  updated_by_name           text,
  unique (id, property_id)
);

-- A contact can only point at an owner of the SAME property (enforced by the database).
create table if not exists public.owner_contacts (
  id                text primary key,
  property_id       text not null,
  owner_id          text not null,
  phone             text,
  phone_type        text,
  connection_status text,
  annotation        text,
  highlight         text,
  source_ref        text,
  source_values     jsonb,
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by_name   text,
  updated_by_name   text,
  foreign key (owner_id, property_id) references public.owners(id, property_id) on delete restrict
);

create table if not exists public.relatives (
  id              text primary key,
  property_id     text not null references public.properties(id) on delete restrict,
  name            text not null,
  age_in_source   int,
  relationship    text,
  address         text,
  phones          jsonb not null default '[]'::jsonb,
  sort_order      int,
  source_ref      text,
  source_values   jsonb,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by_name text,
  updated_by_name text
);

create table if not exists public.associates (
  id              text primary key,
  property_id     text not null references public.properties(id) on delete restrict,
  name            text not null,
  age_in_source   int,
  relationship    text,
  address         text,
  phones          jsonb not null default '[]'::jsonb,
  sort_order      int,
  source_ref      text,
  source_values   jsonb,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by_name text,
  updated_by_name text
);

create table if not exists public.summary_records (
  id                   text primary key,
  property_id          text not null references public.properties(id) on delete restrict,
  row_no               int,
  address_as_written   text,
  owner_as_written     text,
  value_as_written     text,
  acreage_as_written   text,
  last_sold_as_written text,
  link_as_written      text,
  link_basis           text,
  source_ref           text,
  created_at           timestamptz not null default now()
);

create table if not exists public.notes (
  id              text primary key default gen_random_uuid()::text,
  property_id     text not null references public.properties(id) on delete restrict,
  body            text not null check (length(trim(body)) > 0),
  category        text,
  created_by      uuid default auth.uid(),
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  updated_by_name text,
  deleted_at      timestamptz,
  is_import       boolean not null default false
);

create table if not exists public.property_images (
  id               text primary key default gen_random_uuid()::text,
  property_id      text not null references public.properties(id) on delete restrict,
  storage_path     text not null,
  file_name        text,
  caption          text,
  image_notes      text,
  source           text,
  is_source        boolean not null default false,
  sha256           text,
  image_reading    jsonb,
  verification     text,
  uploaded_by_name text,
  uploaded_at      timestamptz not null default now(),
  updated_at       timestamptz,
  updated_by_name  text,
  archived         boolean not null default false
);

create table if not exists public.data_issues (
  id                   text primary key default gen_random_uuid()::text,
  property_id          text references public.properties(id) on delete restrict,
  related_property_ids text[] not null default '{}',
  severity             text not null check (severity in ('critical','conflict','info')),
  category             text,
  field                text,
  title                text not null,
  detail               text,
  issue_values         jsonb not null default '[]'::jsonb,
  status               text not null default 'open' check (status in ('open','accepted','resolved')),
  resolution_note      text,
  resolved_by_name     text,
  resolved_at          timestamptz,
  created_at           timestamptz not null default now(),
  created_by_name      text
);

-- County parcel lookups (Palm Beach County GIS), kept apart from the source document.
create table if not exists public.parcel_lookups (
  property_id        text primary key references public.properties(id) on delete restrict,
  parcel_id          text,
  source             text,
  fetched_at         timestamptz,
  status             text check (status in ('found','not_found','multiple','error')),
  attributes         jsonb,
  geometry           jsonb,
  centroid_lat       double precision,
  centroid_lng       double precision,
  geocode            jsonb,
  geocode_checked_at timestamptz,
  error              text,
  updated_at         timestamptz not null default now()
);

create table if not exists public.app_settings (
  key             text primary key,
  value           jsonb,
  updated_at      timestamptz not null default now(),
  updated_by_name text
);

create table if not exists public.audit_log (
  id              bigserial primary key,
  table_name      text not null,
  row_id          text,
  property_id     text,
  action          text not null,
  field           text,
  old_value       jsonb,
  new_value       jsonb,
  note            text,
  changed_by_name text,
  changed_at      timestamptz not null default now()
);
create index if not exists audit_log_property_idx on public.audit_log (property_id, changed_at desc);
create index if not exists notes_property_idx on public.notes (property_id, created_at desc);

-- ---------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------

-- Stamp who/when on every insert and update.
create or replace function public.stamp_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    NEW.created_by_name := coalesce(NEW.created_by_name, public.current_member_name());
    NEW.updated_at := now();
  else
    NEW.created_at := OLD.created_at;
    NEW.created_by_name := OLD.created_by_name;
    NEW.updated_at := now();
    NEW.updated_by_name := public.current_member_name();
  end if;
  return NEW;
end $$;

-- Original source values can never be changed, and source rows can never be deleted.
create or replace function public.protect_source() returns trigger
language plpgsql set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.source_values is not null then
      raise exception 'Source records cannot be deleted. Archive them instead.';
    end if;
    return OLD;
  end if;
  if OLD.source_values is not null and NEW.source_values is distinct from OLD.source_values then
    raise exception 'Original source values cannot be changed.';
  end if;
  if NEW.id is distinct from OLD.id then
    raise exception 'Record IDs cannot be changed.';
  end if;
  return NEW;
end $$;

-- Children can never be moved to a different property.
create or replace function public.protect_property_link() returns trigger
language plpgsql set search_path = public as $$
begin
  if NEW.property_id is distinct from OLD.property_id then
    raise exception 'Records cannot be moved to a different property.';
  end if;
  return NEW;
end $$;

-- Notes: author and creation time are fixed; edits are timestamped.
create or replace function public.stamp_note() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if not NEW.is_import then
      NEW.created_by := auth.uid();
      NEW.created_by_name := public.current_member_name();
      NEW.created_at := now();
    end if;
    NEW.updated_at := null;
  else
    if NEW.property_id is distinct from OLD.property_id then
      raise exception 'Notes cannot be moved to a different property.';
    end if;
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
    NEW.created_at := OLD.created_at;
    NEW.is_import := OLD.is_import;
    NEW.updated_at := now();
    NEW.updated_by_name := public.current_member_name();
  end if;
  return NEW;
end $$;

-- Images from the source document are fixed (caption / notes can still be edited).
create or replace function public.protect_image() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Images cannot be deleted. Archive them instead.';
  end if;
  if TG_OP = 'INSERT' then
    NEW.uploaded_by_name := coalesce(NEW.uploaded_by_name, public.current_member_name());
    return NEW;
  end if;
  if NEW.property_id is distinct from OLD.property_id then
    raise exception 'Images cannot be moved to a different property.';
  end if;
  if OLD.is_source and (NEW.storage_path, NEW.sha256, NEW.source, NEW.is_source, NEW.image_reading)
       is distinct from (OLD.storage_path, OLD.sha256, OLD.source, OLD.is_source, OLD.image_reading) then
    raise exception 'Source-document images cannot be replaced.';
  end if;
  NEW.updated_at := now();
  NEW.updated_by_name := public.current_member_name();
  return NEW;
end $$;

-- Issues: what was found stays as found; only the review status can change.
create or replace function public.protect_issue() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Review items cannot be deleted. Mark them resolved instead.';
  end if;
  if TG_OP = 'INSERT' then
    NEW.created_by_name := coalesce(NEW.created_by_name, public.current_member_name());
    return NEW;
  end if;
  if (NEW.property_id, NEW.severity, NEW.category, NEW.field, NEW.title, NEW.detail, NEW.issue_values)
       is distinct from (OLD.property_id, OLD.severity, OLD.category, OLD.field, OLD.title, OLD.detail, OLD.issue_values) then
    raise exception 'Review items cannot be rewritten. Only their status and resolution can change.';
  end if;
  if NEW.status is distinct from OLD.status then
    NEW.resolved_by_name := public.current_member_name();
    NEW.resolved_at := case when NEW.status = 'open' then null else now() end;
  end if;
  return NEW;
end $$;

create or replace function public.protect_readonly() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'This table is read-only.';
end $$;

-- Field-by-field audit trail.
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb; n jsonb; k text; pid text; rid text;
  who text := public.current_member_name();
  skip text[] := array['updated_at','updated_by_name','created_at','created_by_name','created_by',
                       'resolved_by_name','resolved_at','reviewed_at','reviewed_by_name','location_checked_at'];
begin
  if TG_OP = 'INSERT' then
    n := to_jsonb(NEW);
    -- rows imported from the source document are logged once by the importer, not row by row
    if jsonb_typeof(n -> 'source_values') = 'object' or coalesce((n ->> 'is_import')::boolean, false)
       or coalesce((n ->> 'is_source')::boolean, false)
       or coalesce(n ->> 'created_by_name', '') = 'Imported from source document' then
      return NEW;
    end if;
    pid := case when TG_TABLE_NAME = 'properties' then n ->> 'id' else n ->> 'property_id' end;
    rid := coalesce(n ->> 'id', n ->> 'key', n ->> 'email');
    insert into public.audit_log (table_name, row_id, property_id, action, new_value, changed_by_name)
    values (TG_TABLE_NAME, rid, pid, 'insert', n - 'geometry', who);
    return NEW;
  elsif TG_OP = 'UPDATE' then
    o := to_jsonb(OLD); n := to_jsonb(NEW);
    pid := case when TG_TABLE_NAME = 'properties' then n ->> 'id' else n ->> 'property_id' end;
    rid := coalesce(n ->> 'id', n ->> 'key', n ->> 'email');
    for k in select jsonb_object_keys(n) loop
      continue when k = any(skip);
      if (o -> k) is distinct from (n -> k) then
        insert into public.audit_log (table_name, row_id, property_id, action, field, old_value, new_value, changed_by_name)
        values (TG_TABLE_NAME, rid, pid, 'update', k,
                case when k = 'geometry' and o -> k <> 'null'::jsonb then '"(parcel outline)"'::jsonb else o -> k end,
                case when k = 'geometry' and n -> k <> 'null'::jsonb then '"(parcel outline)"'::jsonb else n -> k end,
                who);
      end if;
    end loop;
    return NEW;
  else
    o := to_jsonb(OLD);
    insert into public.audit_log (table_name, row_id, property_id, action, old_value, changed_by_name)
    values (TG_TABLE_NAME, coalesce(o ->> 'id', o ->> 'key', o ->> 'email'),
            case when TG_TABLE_NAME = 'properties' then o ->> 'id' else o ->> 'property_id' end,
            'delete', o, who);
    return OLD;
  end if;
end $$;

-- Attach triggers (drop first so this file can be re-run).
do $$
declare t text;
begin
  foreach t in array array['properties','owners','owner_contacts','relatives','associates'] loop
    execute format('drop trigger if exists stamp_row on public.%I', t);
    execute format('create trigger stamp_row before insert or update on public.%I for each row execute function public.stamp_row()', t);
    execute format('drop trigger if exists protect_source on public.%I', t);
    execute format('create trigger protect_source before update or delete on public.%I for each row execute function public.protect_source()', t);
  end loop;
  foreach t in array array['owners','owner_contacts','relatives','associates'] loop
    execute format('drop trigger if exists protect_property_link on public.%I', t);
    execute format('create trigger protect_property_link before update on public.%I for each row execute function public.protect_property_link()', t);
  end loop;
  foreach t in array array['properties','owners','owner_contacts','relatives','associates','notes',
                           'property_images','data_issues','app_settings','app_members'] loop
    execute format('drop trigger if exists audit_row on public.%I', t);
    execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;

drop trigger if exists stamp_note on public.notes;
create trigger stamp_note before insert or update on public.notes for each row execute function public.stamp_note();
drop trigger if exists protect_image on public.property_images;
create trigger protect_image before insert or update or delete on public.property_images for each row execute function public.protect_image();
drop trigger if exists protect_issue on public.data_issues;
create trigger protect_issue before insert or update or delete on public.data_issues for each row execute function public.protect_issue();
drop trigger if exists protect_readonly on public.summary_records;
create trigger protect_readonly before update or delete on public.summary_records for each row execute function public.protect_readonly();
drop trigger if exists protect_readonly on public.audit_log;
create trigger protect_readonly before update or delete on public.audit_log for each row execute function public.protect_readonly();

-- ---------------------------------------------------------------------
-- ACCESS RULES — nothing is visible without logging in as a listed member
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['properties','owners','owner_contacts','relatives','associates','summary_records',
                           'notes','property_images','data_issues','parcel_lookups','app_settings','audit_log','app_members'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists members_select on public.%I', t);
    execute format('drop policy if exists members_insert on public.%I', t);
    execute format('drop policy if exists members_update on public.%I', t);
    execute format('drop policy if exists members_delete on public.%I', t);
    execute format('create policy members_select on public.%I for select to authenticated using (public.is_member())', t);
    execute format('create policy members_insert on public.%I for insert to authenticated with check (public.is_member())', t);
    if t not in ('audit_log','summary_records') then
      execute format('create policy members_update on public.%I for update to authenticated using (public.is_member()) with check (public.is_member())', t);
    end if;
  end loop;
end $$;
-- Removing a team member is the only delete allowed.
create policy members_delete on public.app_members for delete to authenticated using (public.is_member());
-- Logged-in users can reach the tables; the access rules above still limit them to team members.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_member() to authenticated;
grant execute on function public.current_member_name() to authenticated;
revoke all on all tables in schema public from anon;
-- Trigger helpers only run inside the database; nobody calls them directly.
revoke execute on function public.audit_row(), public.stamp_row(), public.stamp_note(), public.protect_image(), public.protect_issue(),
  public.protect_source(), public.protect_property_link(), public.protect_readonly() from public, anon, authenticated;
revoke execute on function public.is_member(), public.current_member_name() from public, anon;
grant execute on function public.is_member(), public.current_member_name() to authenticated;

-- ---------------------------------------------------------------------
-- PRIVATE PHOTO STORAGE
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', false)
on conflict (id) do nothing;

drop policy if exists "cflandglide members read images" on storage.objects;
drop policy if exists "cflandglide members upload images" on storage.objects;
create policy "cflandglide members read images" on storage.objects
  for select to authenticated using (bucket_id = 'property-images' and public.is_member());
create policy "cflandglide members upload images" on storage.objects
  for insert to authenticated with check (bucket_id = 'property-images' and public.is_member());

-- ---------------------------------------------------------------------
-- DEFAULT SETTINGS (editable in the app)
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value, updated_by_name) values
  ('statuses', '["New","Researching","Needs Verification","Contacted","Follow Up","Interested","Not Interested","Complete"]', 'setup'),
  ('verification_statuses', '["Unverified","Partially verified","Verified"]', 'setup'),
  ('note_categories', '["General","Call","Research","Site visit","Follow-up"]', 'setup'),
  ('county_parcel_service', '"https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Parcels_and_Property_Details_WebMercator/FeatureServer/0"', 'setup')
on conflict (key) do nothing;

-- Done. Next: in Supabase go to Authentication → Users → Add user, and create a login
-- (email + password) for each email listed in STEP 1.
