-- Grocery Community starter schema (Supabase / Postgres)
-- Paste into Supabase SQL editor and run.

create extension if not exists "pgcrypto";

-- Products are public (read-only from client), seed via dashboard or SQL.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  price_cents integer not null default 0,
  image_url text,
  created_at timestamptz not null default now()
);

-- Shopping lists are private to the user.
create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  qty integer not null default 1,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Community posts are public to read; authenticated users can create.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.products enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.posts enable row level security;

-- Policies: products
create policy "products are readable by anyone"
on public.products for select
to anon, authenticated
using (true);

-- Optional: only allow inserts/updates from service role (dashboard)
-- (No insert/update/delete policies for anon/authenticated)

-- Policies: shopping_lists
create policy "lists are readable by owner"
on public.shopping_lists for select
to authenticated
using (auth.uid() = user_id);

create policy "lists can be created by owner"
on public.shopping_lists for insert
to authenticated
with check (auth.uid() = user_id);

create policy "lists can be updated by owner"
on public.shopping_lists for update
to authenticated
using (auth.uid() = user_id);

create policy "lists can be deleted by owner"
on public.shopping_lists for delete
to authenticated
using (auth.uid() = user_id);

-- Policies: shopping_list_items
create policy "items readable by owner"
on public.shopping_list_items for select
to authenticated
using (auth.uid() = user_id);

create policy "items insert by owner"
on public.shopping_list_items for insert
to authenticated
with check (auth.uid() = user_id);

create policy "items update by owner"
on public.shopping_list_items for update
to authenticated
using (auth.uid() = user_id);

create policy "items delete by owner"
on public.shopping_list_items for delete
to authenticated
using (auth.uid() = user_id);

-- Policies: posts
create policy "posts readable by anyone"
on public.posts for select
to anon, authenticated
using (true);

create policy "posts insert by authenticated"
on public.posts for insert
to authenticated
with check (auth.uid() = user_id);

create policy "posts update by owner"
on public.posts for update
to authenticated
using (auth.uid() = user_id);

create policy "posts delete by owner"
on public.posts for delete
to authenticated
using (auth.uid() = user_id);
