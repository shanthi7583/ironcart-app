-- Holds the order a customer is about to pay for, from the moment the Cashfree
-- payment session is created until the order is actually written.
--
-- Why it exists: the order details (cart, address, pickup slot) only lived in the
-- customer's browser. If they paid and then closed the tab, lost signal or ran out of
-- battery before getting back to the app, the money was taken and no order existed
-- anywhere. Cashfree's webhook now has its own copy and can finish the job.
--
-- The row is also the claim token that keeps the webhook and the app's own return path
-- from both creating the same order: whoever deletes it first does the write.
--
-- Run this in the Supabase SQL editor.

create table if not exists public.pending_orders (
  gateway_order_id text primary key,
  customer_phone   text not null,
  draft            jsonb not null,
  created_at       timestamptz not null default now()
);

create index if not exists pending_orders_created_at_idx
  on public.pending_orders (created_at);

-- Only the server (service role) ever touches this table. RLS on with no policies
-- means the anon key cannot read or write it, which matters because the draft carries
-- the customer's name, phone and address.
alter table public.pending_orders enable row level security;

-- Abandoned checkouts never get claimed, so they'd accumulate forever. Cashfree
-- payment sessions expire well inside an hour; a day is a generous safety margin.
-- Either schedule this with pg_cron, or just run it by hand occasionally.
--   delete from public.pending_orders where created_at < now() - interval '1 day';
