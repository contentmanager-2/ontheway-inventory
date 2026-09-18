-- Схема следующего этапа. Применять после создания проекта Supabase.

create extension if not exists pgcrypto;

create type item_status as enum ('draft', 'available', 'reserved', 'sold', 'returned', 'archived');

create table public.items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  brand text not null,
  category text,
  catalog_key text unique,
  product_type text,
  color text,
  size text,
  quantity integer not null default 0 check (quantity >= 0),
  measurements text,
  notes text,
  purchase_price numeric(12,2) not null check (purchase_price >= 0),
  list_price numeric(12,2) not null check (list_price >= 0),
  status item_status not null default 'draft',
  archive_reason text,
  archived_at timestamptz,
  main_image_path text,
  avito_item_id bigint unique,
  avito_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Объявление Авито является источником, а не единицей товарного остатка.
-- Одно объявление-комплект может быть связано с несколькими вариантами.
create table public.avito_listings (
  id bigint primary key,
  title text not null,
  description text,
  price numeric(12,2) not null default 0,
  image_url text,
  url text not null,
  captured_at timestamptz,
  source_payload jsonb,
  created_at timestamptz not null default now()
);

create table public.item_avito_listings (
  item_id uuid not null references public.items(id) on delete cascade,
  avito_listing_id bigint not null references public.avito_listings(id) on delete cascade,
  primary key (item_id, avito_listing_id)
);

create table public.item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id),
  sold_at date not null default current_date,
  channel text not null,
  sale_price numeric(12,2) not null check (sale_price >= 0),
  purchase_cost_snapshot numeric(12,2) not null check (purchase_cost_snapshot >= 0),
  commission numeric(12,2) not null default 0,
  promotion_cost numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  other_cost numeric(12,2) not null default 0,
  avito_order_id text unique,
  source text not null default 'manual',
  source_payload jsonb,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null,
  amount numeric(12,2) not null check (amount >= 0),
  note text,
  item_id uuid references public.items(id),
  source text not null default 'manual',
  external_id text unique,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.items enable row level security;
alter table public.avito_listings enable row level security;
alter table public.item_avito_listings enable row level security;
alter table public.item_images enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_log enable row level security;

create policy "authenticated users manage items"
  on public.items for all to authenticated using (true) with check (true);
create policy "authenticated users manage avito listings"
  on public.avito_listings for all to authenticated using (true) with check (true);
create policy "authenticated users manage item avito links"
  on public.item_avito_listings for all to authenticated using (true) with check (true);
create policy "authenticated users manage item images"
  on public.item_images for all to authenticated using (true) with check (true);
create policy "authenticated users manage sales"
  on public.sales for all to authenticated using (true) with check (true);
create policy "authenticated users manage expenses"
  on public.expenses for all to authenticated using (true) with check (true);
create policy "authenticated users read audit log"
  on public.audit_log for select to authenticated using (true);

create or replace view public.sales_financials
with (security_invoker = true) as
select
  sales.*,
  sale_price - purchase_cost_snapshot as gross_profit,
  sale_price - purchase_cost_snapshot - commission - promotion_cost - shipping_cost - other_cost as contribution_profit
from public.sales;
