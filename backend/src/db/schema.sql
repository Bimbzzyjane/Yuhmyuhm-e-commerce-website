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
--
-- RLS alone is not enough, though: functions and views carry their own
-- privileges and Postgres + Supabase both hand those to the browser-facing
-- roles by default. Every helper this file creates is therefore revoked from
-- PUBLIC/anon/authenticated and granted only to service_role — see the
-- "Function privileges" and "Verification helper" sections.
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
-- Atomic order creation
-- ---------------------------------------------------------------------------
-- `SupabaseOrderRepository.create()` calls this instead of a nested PostgREST
-- insert (`{ order_items: [...] }` inside an `orders` insert). Nested inserts
-- are not available on this deployment — PostgREST answers PGRST204, "Could not
-- find the 'order_items' column of 'orders' in the schema cache" — and a
-- two-statement fallback would leave a committed order with no line items if
-- the second statement failed. One function call gives real transactional
-- atomicity: Postgres runs the whole body in a single implicit transaction, so
-- a failed item insert rolls the order back with it and no orphaned order can
-- survive. (Sequences are NOT transactional, so the burned order number is
-- expected.)
--
-- SECURITY INVOKER, deliberately: the API connects with the service role, which
-- has BYPASSRLS, so no privilege elevation is needed. EXECUTE is revoked from
-- PUBLIC and from the browser-facing roles (otherwise the publishable key could
-- create orders through /rest/v1/rpc) and granted only to service_role — the
-- statements live together in "Function privileges" below. RLS stays
-- deny-by-default; only the backend may call this.

create or replace function public.create_order_with_items(
  p_user_id          uuid,
  p_customer_name    text,
  p_email            text,
  p_phone            text,
  p_delivery_address text,
  p_delivery_city    text,
  p_delivery_notes   text,
  p_subtotal         numeric,
  p_delivery_fee     numeric,
  p_total            numeric,
  p_status           text,
  p_items            jsonb
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_order  public.orders%rowtype;
  v_item   public.order_items%rowtype;
  v_source jsonb;
  v_items  jsonb := '[]'::jsonb;
begin
  -- `order_number` is deliberately absent so the column default
  -- (public.next_order_number()) assigns it from the sequence, exactly as it
  -- did before this function existed, so concurrent checkouts cannot collide.
  insert into public.orders (
    user_id, customer_name, email, phone,
    delivery_address, delivery_city, delivery_notes,
    subtotal, delivery_fee, total, status
  )
  values (
    p_user_id, p_customer_name, p_email, p_phone,
    p_delivery_address, p_delivery_city, p_delivery_notes,
    p_subtotal, p_delivery_fee, p_total, coalesce(p_status, 'pending')
  )
  returning * into v_order;

  -- jsonb_array_elements preserves array order, so the caller's line order
  -- survives the round trip and the response matches what the service built.
  for v_source in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.order_items (
      order_id, product_id, product_name, product_slug,
      product_image_url, unit_price, quantity, line_total
    )
    values (
      v_order.id,
      nullif(v_source ->> 'product_id', '')::uuid,
      v_source ->> 'product_name',
      v_source ->> 'product_slug',
      v_source ->> 'product_image_url',
      (v_source ->> 'unit_price')::numeric,
      (v_source ->> 'quantity')::integer,
      (v_source ->> 'line_total')::numeric
    )
    returning * into v_item;

    v_items := v_items || jsonb_build_array(to_jsonb(v_item));
  end loop;

  return jsonb_build_object('order', to_jsonb(v_order), 'items', v_items);
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE on every new function to PUBLIC, and Supabase's
-- default privileges additionally hand it to `anon` and `authenticated` (the
-- roles behind the browser's publishable key). Left alone, all three functions
-- in this file would be callable straight through PostgREST's /rest/v1/rpc
-- with the public key and no backend involvement whatsoever:
--
--   create_order_with_items(...) -> write orders and line items directly
--   next_order_number()          -> burn order numbers indefinitely
--   set_updated_at()             -> a trigger function, callable as an RPC
--
-- None of them is a public API, so all three are revoked from PUBLIC and from
-- the browser-facing roles, then granted only to `service_role` — the role the
-- Express API authenticates as. RLS is untouched.
--
-- Two subtleties keep this from breaking normal writes:
--
--   * `next_order_number()` is the column DEFAULT on `orders.order_number`, and
--     a default expression is evaluated with the privileges of the INSERTING
--     role. Orders are only ever inserted by service_role (inside
--     create_order_with_items), so that grant is what keeps order numbers
--     working at all.
--   * `set_updated_at()` is a TRIGGER function. Postgres checks EXECUTE when a
--     trigger is CREATED, not each time it fires, and the role creating the
--     triggers below is the schema owner — so they keep firing for every
--     writer. The grant to service_role is belt and braces.

revoke all on function public.create_order_with_items(
  uuid, text, text, text, text, text, text, numeric, numeric, numeric, text, jsonb
) from public;

grant execute on function public.create_order_with_items(
  uuid, text, text, text, text, text, text, numeric, numeric, numeric, text, jsonb
) to service_role;

revoke all on function public.next_order_number() from public;
revoke all on function public.set_updated_at() from public;

grant execute on function public.next_order_number() to service_role;
grant execute on function public.set_updated_at() to service_role;

-- `revoke ... from public` does NOT remove a grant Supabase's default
-- privileges gave to `anon`/`authenticated` directly, so those are revoked
-- explicitly too. Those roles do not exist on a plain Postgres instance, so
-- they are only touched when present — which keeps this file runnable against
-- both.
do $$
declare
  browser_role text;
begin
  foreach browser_role in array array['anon', 'authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = browser_role) then
      execute format(
        'revoke all on function public.create_order_with_items(
           uuid, text, text, text, text, text, text, numeric, numeric, numeric, text, jsonb
         ) from %I',
        browser_role
      );
      execute format('revoke all on function public.next_order_number() from %I', browser_role);
      execute format('revoke all on function public.set_updated_at() from %I', browser_role);
    end if;
  end loop;
end $$;

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
-- Verification helper (optional): row counts, for confirming a seed
-- ---------------------------------------------------------------------------
-- NOT a public endpoint — it exists so an operator can sanity-check the
-- catalogue from the dashboard. A bare view over RLS-protected tables is a
-- classic way to leak data, so it is guarded twice:
--
--   1. `security_invoker = true` (Postgres 15+; every Supabase project
--      qualifies) makes the view run with the CALLER's privileges and RLS
--      instead of the view owner's. Without it the view would aggregate rows
--      the caller is not allowed to select, silently bypassing the RLS above —
--      and the counts themselves leak order volume. With it, service_role
--      (which bypasses RLS by design) still sees true counts, while anyone else
--      sees only what RLS permits.
--   2. SELECT is revoked from the browser-facing roles outright, so the helper
--      is unreachable with the publishable key even if the grants ever change.
--
-- The explicit revoke is needed because Supabase's default privileges grant to
-- `anon`/`authenticated` directly, which `revoke ... from public` does not
-- undo. Those roles are absent on plain Postgres, so they are only touched when
-- present.

create or replace view public.catalogue_summary
  with (security_invoker = true)
as
  select
    (select count(*) from public.categories) as categories,
    (select count(*) from public.products)   as products,
    (select count(*) from public.products where is_active) as active_products,
    (select count(*) from public.orders)     as orders;

revoke all on public.catalogue_summary from public;

do $$
declare
  browser_role text;
begin
  foreach browser_role in array array['anon', 'authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = browser_role) then
      execute format('revoke all on public.catalogue_summary from %I', browser_role);
    end if;
  end loop;
end $$;

grant select on public.catalogue_summary to service_role;


