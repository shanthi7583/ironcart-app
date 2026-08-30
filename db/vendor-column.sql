-- Records which ironing shop actually did the work on each order.
-- Run this in the Supabase SQL editor.
--
-- There is only one vendor today, so every row gets the same value and nothing in the
-- app behaves differently. The point is purely that orders placed from now on carry
-- the answer. Adding this column later is easy; deciding retrospectively which shop
-- handled an order from six months of history is not, and every multi-vendor feature
-- — routing, per-vendor payouts, per-vendor quality — is built on top of it.
--
-- Safe to run more than once.

alter table public.orders
  add column if not exists vendor_id text not null default 'default';

-- Reporting will always be "orders for this vendor, newest first".
create index if not exists orders_vendor_idx
  on public.orders (vendor_id, created_at desc);
