-- ============================================================
-- FenceQuoter MVP — Supabase Migration (aligned with CLAUDE.md)
-- Run in Supabase SQL Editor or as supabase/migrations/001_initial.sql
-- ============================================================

begin;

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ============================================================
-- 1. TABLES
-- ============================================================

-- PROFILES (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null default '',
  logo_url text,
  phone text,
  email text,
  region text not null default 'US',
  currency text not null default 'USD',
  unit_system text not null default 'imperial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SETTINGS (1:1 with user)
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hourly_rate numeric(12,2) not null default 45.00,
  default_markup_percent int not null default 20,       -- целое число: 20 = 20%
  tax_percent int not null default 0,                    -- целое число: 0 = 0%
  terms_template text not null default
    'Thank you for the opportunity to quote this project. This quote is valid for 30 days. Material prices may vary.',
  updated_at timestamptz not null default now()
);

-- MATERIALS CATALOG (per-user, seeded at onboarding, editable)
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fence_type text not null,                               -- wood_privacy | wood_picket | chain_link | vinyl | aluminum
  name text not null,
  unit text not null default 'each',
  unit_price numeric(12,2) not null default 0.00,
  category text not null default 'material',              -- post | rail | panel | concrete | hardware | gate
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fence_type, category, name)
);

-- QUOTES (главная таблица, variants хранятся в JSONB)
--
-- variants jsonb формат:
-- [
--   {
--     "type": "budget",
--     "markup_percent": 15,
--     "items": [
--       { "name": "4x4 Post", "qty": 14, "unit": "each", "unit_price": 14.00, "total": 196.00, "category": "material" },
--       ...
--     ],
--     "materials_total": 1200.00,
--     "labor_total": 450.00,
--     "subtotal": 1650.00,
--     "markup_amount": 247.50,
--     "tax_amount": 0.00,
--     "total": 1897.50
--   },
--   { "type": "standard", ... },
--   { "type": "premium", ... }
-- ]

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Client info
  client_name text not null,
  client_email text,
  client_phone text,
  client_address text default '',                         -- nullable: подрядчик может не знать адрес

  -- Status
  status text not null default 'draft'
    check (status in ('draft','calculated','sent','accepted','rejected')),

  -- Raw inputs (что юзер ввёл в форму)
  -- { fence_type, length, height, gates_standard, gates_large, remove_old, terrain, notes }
  inputs jsonb not null default '{}'::jsonb,

  -- Calculated variants (массив из 3 объектов — budget/standard/premium)
  variants jsonb default '[]'::jsonb,

  -- Which variant the user selected for PDF
  selected_variant text default 'standard'
    check (selected_variant in ('budget','standard','premium')),

  -- Custom line items added by user (поверх расчёта)
  -- [ { "name": "Extra cleanup", "qty": 1, "unit_price": 150, "total": 150 } ]
  custom_items jsonb default '[]'::jsonb,

  -- Totals of the selected variant (denormalized for quick list display)
  subtotal numeric(12,2) not null default 0.00,
  markup_amount numeric(12,2) not null default 0.00,
  tax_amount numeric(12,2) not null default 0.00,
  total numeric(12,2) not null default 0.00,

  -- PDF & sending
  pdf_url text,
  sent_via text check (sent_via in ('email','sms') or sent_via is null),
  sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotes_user_created on public.quotes(user_id, created_at desc);
create index if not exists idx_quotes_user_status on public.quotes(user_id, status);

-- QUOTE PHOTOS
create table if not exists public.quote_photos (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_quote_photos_quote on public.quote_photos(quote_id);

-- ============================================================
-- 2. UPDATED_AT TRIGGERS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated on public.settings;
create trigger trg_settings_updated
  before update on public.settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_materials_updated on public.materials;
create trigger trg_materials_updated
  before update on public.materials
  for each row execute function public.set_updated_at();

drop trigger if exists trg_quotes_updated on public.quotes;
create trigger trg_quotes_updated
  before update on public.quotes
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. AUTO-CREATE PROFILE + SETTINGS ON NEW USER
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, company_name, region, currency, unit_system)
  values (new.id, new.email, '', 'US', 'USD', 'imperial')
  on conflict (id) do nothing;

  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 4. RLS (all tables, all CRUD operations)
-- ============================================================

-- PROFILES
alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- SETTINGS
alter table public.settings enable row level security;

drop policy if exists "settings_select" on public.settings;
create policy "settings_select" on public.settings
  for select using (user_id = auth.uid());

drop policy if exists "settings_insert" on public.settings;
create policy "settings_insert" on public.settings
  for insert with check (user_id = auth.uid());

drop policy if exists "settings_update" on public.settings;
create policy "settings_update" on public.settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- MATERIALS
alter table public.materials enable row level security;

drop policy if exists "materials_select" on public.materials;
create policy "materials_select" on public.materials
  for select using (user_id = auth.uid());

drop policy if exists "materials_insert" on public.materials;
create policy "materials_insert" on public.materials
  for insert with check (user_id = auth.uid());

drop policy if exists "materials_update" on public.materials;
create policy "materials_update" on public.materials
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "materials_delete" on public.materials;
create policy "materials_delete" on public.materials
  for delete using (user_id = auth.uid());

-- QUOTES
alter table public.quotes enable row level security;

drop policy if exists "quotes_select" on public.quotes;
create policy "quotes_select" on public.quotes
  for select using (user_id = auth.uid());

drop policy if exists "quotes_insert" on public.quotes;
create policy "quotes_insert" on public.quotes
  for insert with check (user_id = auth.uid());

drop policy if exists "quotes_update" on public.quotes;
create policy "quotes_update" on public.quotes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "quotes_delete" on public.quotes;
create policy "quotes_delete" on public.quotes
  for delete using (user_id = auth.uid());

-- QUOTE PHOTOS
alter table public.quote_photos enable row level security;

drop policy if exists "quote_photos_select" on public.quote_photos;
create policy "quote_photos_select" on public.quote_photos
  for select using (user_id = auth.uid());

drop policy if exists "quote_photos_insert" on public.quote_photos;
create policy "quote_photos_insert" on public.quote_photos
  for insert with check (user_id = auth.uid());

drop policy if exists "quote_photos_delete" on public.quote_photos;
create policy "quote_photos_delete" on public.quote_photos
  for delete using (user_id = auth.uid());

-- ============================================================
-- 5. SEED FUNCTION (call after onboarding)
--    Usage from app: await supabase.rpc('seed_materials_for_user')
-- ============================================================

create or replace function public.seed_materials_for_user()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- ============================================
  -- WOOD PRIVACY
  -- ============================================
  insert into public.materials (user_id, fence_type, name, unit, unit_price, category, sort_order) values
    (uid, 'wood_privacy', '4x4 Pressure-treated post (8ft)',          'each',  14.00, 'post',     1),
    (uid, 'wood_privacy', '2x4 Treated rail (8ft)',                   'each',   5.50, 'rail',     2),
    (uid, 'wood_privacy', 'Privacy picket (6ft, dog-ear)',            'each',   3.25, 'panel',    3),
    (uid, 'wood_privacy', 'Concrete mix 50lb bag',                    'bag',    5.50, 'concrete', 4),
    (uid, 'wood_privacy', 'Post caps, screws, brackets (per section)','set',    8.00, 'hardware', 5),
    (uid, 'wood_privacy', 'Standard walk gate (wood)',                'each',  85.00, 'gate',     6),
    (uid, 'wood_privacy', 'Double driveway gate (wood)',              'each', 250.00, 'gate',     7)
  on conflict (user_id, fence_type, category, name) do nothing;

  -- ============================================
  -- WOOD PICKET
  -- ============================================
  insert into public.materials (user_id, fence_type, name, unit, unit_price, category, sort_order) values
    (uid, 'wood_picket', '4x4 Post (6ft)',                           'each',  10.00, 'post',     1),
    (uid, 'wood_picket', '2x4 Rail (8ft)',                           'each',   5.50, 'rail',     2),
    (uid, 'wood_picket', 'Picket (42in, pointed)',                   'each',   2.00, 'panel',    3),
    (uid, 'wood_picket', 'Concrete mix 50lb bag',                    'bag',    5.50, 'concrete', 4),
    (uid, 'wood_picket', 'Screws, post caps (per section)',          'set',    6.00, 'hardware', 5),
    (uid, 'wood_picket', 'Walk gate (picket)',                       'each',  70.00, 'gate',     6),
    (uid, 'wood_picket', 'Double gate (picket)',                     'each', 180.00, 'gate',     7)
  on conflict (user_id, fence_type, category, name) do nothing;

  -- ============================================
  -- CHAIN LINK
  -- ============================================
  insert into public.materials (user_id, fence_type, name, unit, unit_price, category, sort_order) values
    (uid, 'chain_link', 'Terminal post (galvanized)',                 'each',  18.00, 'post',     1),
    (uid, 'chain_link', 'Line post (galvanized)',                    'each',  11.00, 'post',     2),
    (uid, 'chain_link', 'Top rail (10.5ft)',                         'each',   9.50, 'rail',     3),
    (uid, 'chain_link', 'Chain link fabric (per linear ft)',         'ft',     3.75, 'panel',    4),
    (uid, 'chain_link', 'Concrete mix 50lb bag',                    'bag',    5.50, 'concrete', 5),
    (uid, 'chain_link', 'Ties, tension bars, bands (per section)',  'set',    6.00, 'hardware', 6),
    (uid, 'chain_link', 'Walk gate (chain link, 4ft)',               'each',  95.00, 'gate',     7),
    (uid, 'chain_link', 'Double driveway gate (chain link)',         'each', 275.00, 'gate',     8)
  on conflict (user_id, fence_type, category, name) do nothing;

  -- ============================================
  -- VINYL
  -- ============================================
  insert into public.materials (user_id, fence_type, name, unit, unit_price, category, sort_order) values
    (uid, 'vinyl', 'Vinyl post (5x5, with cap)',                     'each',  28.00, 'post',     1),
    (uid, 'vinyl', 'Vinyl panel (6ft x 8ft)',                        'each',  65.00, 'panel',    2),
    (uid, 'vinyl', 'Concrete mix 50lb bag',                          'bag',    5.50, 'concrete', 3),
    (uid, 'vinyl', 'Brackets, screws kit (per section)',             'set',    5.00, 'hardware', 4),
    (uid, 'vinyl', 'Standard vinyl gate',                            'each', 150.00, 'gate',     5),
    (uid, 'vinyl', 'Double vinyl driveway gate',                     'each', 400.00, 'gate',     6)
  on conflict (user_id, fence_type, category, name) do nothing;

  -- ============================================
  -- ALUMINUM
  -- ============================================
  insert into public.materials (user_id, fence_type, name, unit, unit_price, category, sort_order) values
    (uid, 'aluminum', 'Aluminum post (2x2)',                         'each',  22.00, 'post',     1),
    (uid, 'aluminum', 'Aluminum panel (6ft section)',                'each',  55.00, 'panel',    2),
    (uid, 'aluminum', 'Concrete mix 50lb bag',                      'bag',    5.50, 'concrete', 3),
    (uid, 'aluminum', 'Post caps, mounting hardware (per section)',  'set',    6.00, 'hardware', 4),
    (uid, 'aluminum', 'Aluminum walk gate',                          'each', 175.00, 'gate',     5),
    (uid, 'aluminum', 'Double aluminum driveway gate',               'each', 450.00, 'gate',     6)
  on conflict (user_id, fence_type, category, name) do nothing;

end;
$$;

-- ============================================================
-- 6. HELPER: count sent quotes this month (for paywall check)
--    Usage: const { data } = await supabase.rpc('sent_quotes_this_month')
--    Returns integer
-- ============================================================

create or replace function public.sent_quotes_this_month()
returns int
language sql
security invoker
stable
set search_path = public
as $$
  select count(*)::int
  from public.quotes
  where user_id = auth.uid()
    and status = 'sent'
    and created_at >= date_trunc('month', now())
    and created_at < date_trunc('month', now()) + interval '1 month';
$$;

commit;
