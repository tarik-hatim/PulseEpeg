-- PulseEPG Supabase schema and RLS hardening
-- Apply only to the intended Supabase project after reviewing this migration.
-- Premium entitlements are server-managed; client sessions cannot grant Pro.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_pro boolean not null default false,
  role text not null default 'user' check (role in ('user', 'pro', 'admin', 'superuser')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_bouquets jsonb not null default '[]'::jsonb,
  favorite_channels jsonb not null default '[]'::jsonb,
  watch_habits jsonb not null default '{}'::jsonb,
  -- Legacy compatibility field only; never use it as an entitlement source.
  is_premium boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;

-- Profiles can be read by their owner. Client writes are deliberately denied.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- User settings are user-owned. Entitlement field is excluded from client updates
-- and must remain unchanged on updates; app code should omit it from upsert payloads.
drop policy if exists "Users can read own settings" on public.user_settings;
create policy "Users can read own settings"
  on public.user_settings for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
  on public.user_settings for insert to authenticated
  with check (auth.uid() = user_id and is_premium = false);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
  on public.user_settings for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.user_settings from anon;
grant select, insert, update on public.user_settings to authenticated;

-- Prevent authenticated users from changing premium fields even if a future
-- permissive policy is accidentally added. service_role/server-side jobs may manage them.
create or replace function public.prevent_client_profile_entitlement_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      new.is_pro := false;
      new.role := 'user';
    else
      new.is_pro := old.is_pro;
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_entitlements on public.profiles;
create trigger protect_profile_entitlements
before insert or update on public.profiles
for each row execute function public.prevent_client_profile_entitlement_changes();

-- Create a free profile automatically for both email/password and Google OAuth
-- because both flows create a row in auth.users.
create or replace function public.create_free_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, is_pro, role)
  values (new.id, false, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_pulseepg on auth.users;
create trigger on_auth_user_created_pulseepg
after insert on auth.users
for each row execute function public.create_free_profile_for_auth_user();

commit;
