-- ===========================================================================
-- Yuhmyuhm Catering Services — database schema
-- ===========================================================================
-- Paste this whole file into the Supabase SQL Editor and press Run.
-- It is IDEMPOTENT: running it twice is a no-op, so it doubles as a migration
-- for an existing project. `npm run db:print-schema` prints it to stdout.
--
-- MONEY: stored as numeric(12,2) in MAJOR units (naira) so the table editor
-- stays readable. The API converts to integer kobo at the repository boundary
-- and does all arithmetic in integers — see backend/src/utils/money.ts.
--
-- SECURITY: RLS is enabled on every table and NO policies are created, which
-- is deny-by-default for `anon` and `authenticated`. Only the backend's
-- service-role key can read or write. The storefront never queries tables.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Race-free, human readable order numbers: YM-2026-0001.
create sequence if not exists public.order_number_seq start 1;

create or replace function public.next_order_number()
returns text
language sql
volatile
as $$
  select 'YM-'
      || to_char(now(), 'YYYY')
      || '-'
      || lpad(nextval('public.order_number_seq')::text, 4, '0');
$$;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  description    text,
  category_id    uuid not null references public.categories (id) on delete restrict,
  price          numeric(12, 2) not null check (price >= 0),
  image_url      text,
  badge          text,
  is_featured    boolean not null default false,
  is_active      boolean not null default true,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category_id);

create index if not exists products_active_sort_idx
  on public.products (sort_order, name) where is_active;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
-- Mirrors auth.users so the API has somewhere to hang profile data and a
-- stable internal id to reference from carts and orders.

create table if not exists public.users (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email        text not null unique,
  full_name    text,
  avatar_url   text,
  phone        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Link to Supabase Auth when it is available, without making this schema
-- impossible to run against a plain Postgres instance.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) and not exists (
    select 1 from pg_constraint where conname = 'users_auth_user_id_fkey'
  ) then
    alter table public.users
      add constraint users_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users (id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Carts
-- ---------------------------------------------------------------------------

create table if not exists public.carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users (id) on delete cascade,
  guest_token uuid,
  status      text not null default 'active'
    check (status in ('active', 'converted', 'merged', 'abandoned')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- A cart belongs to exactly one shopper: either a signed-in user or a guest.
  constraint carts_owner_check check ((user_id is not null) <> (guest_token is not null))
);

-- The partial indexes below enforce "one active cart per owner" in the
-- database itself, so a race can never create duplicates.
create unique index if not exists carts_active_user_idx
  on public.carts (user_id) where status = 'active' and user_id is not null;

create unique index if not exists carts_active_guest_idx
  on public.carts (guest_token) where status = 'active' and guest_token is not null;

create table if not exists public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity   integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Adding the same product twice increments the line instead of duplicating.
  unique (cart_id, product_id)
);

create index if not exists cart_items_cart_idx on public.cart_items (cart_id);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
-- An order is an IMMUTABLE SNAPSHOT. `product_name` and `unit_price` are
-- copied in at purchase time so that renaming or repricing a product later
-- never rewrites a customer's history.

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique default public.next_order_number(),
  user_id          uuid references public.users (id) on delete set null,
  customer_name    text not null,
  email            text not null,
  phone            text not null,
  delivery_address text not null,
  delivery_city    text not null,
  delivery_notes   text,
  subtotal         numeric(12, 2) not null check (subtotal >= 0),
  delivery_fee     numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  total            numeric(12, 2) not null check (total >= 0),
  status           text not null default 'pending'
    check (status in ('pending', 'confirmed', 'processing', 'delivered', 'cancelled')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_email_idx on public.orders (lower(email));

create table if not exists public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  product_name      text not null,
  product_slug      text,
  product_image_url text,
  unit_price        numeric(12, 2) not null check (unit_price >= 0),
  quantity          integer not null check (quantity > 0),
  line_total        numeric(12, 2) not null check (line_total >= 0)
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
-- Postgres has no `create trigger if not exists`, so drop-then-create inside a
-- loop keeps this file re-runnable.

do $$
declare
  target text;
begin
  foreach target in array array[
    'categories', 'products', 'users', 'carts', 'cart_items', 'orders'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', target);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      target
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Enabled with NO policies == deny everything for `anon` and `authenticated`.
-- The Express API uses the service-role key, which bypasses RLS by design, so
-- the browser-facing anon key can never read or mutate these tables directly.
-- This is the second line of defence behind "the frontend never touches the DB".

alter table public.categories enable row level security;
alter table public.products   enable row level security;
alter table public.users      enable row level security;
alter table public.carts      enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders     enable row level security;
alter table public.order_items enable row level security;

-- ---------------------------------------------------------------------------
-- Verification helper (optional): lists row counts so you can confirm a seed
-- ---------------------------------------------------------------------------
create or replace view public.catalogue_summary as
  select
    (select count(*) from public.categories) as categories,
    (select count(*) from public.products)   as products,
    (select count(*) from public.products where is_active) as active_products,
    (select count(*) from public.orders)     as orders;


