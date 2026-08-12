-- Everything the running code expects that production doesn't have yet.
-- Verified against GET /api/admin/schema-check on 7 August 2026.
-- Safe to run more than once.
--
-- Run this whole file in the Supabase SQL editor, then re-run the schema check.

-- 1. WALLET LEDGER — the urgent one.
-- The wallet is live in the app, with a "View transaction history" link. Every top-up
-- and every wallet-paid order writes here. Without the table, money moves and nothing
-- is recorded: a customer who tops up ₹500 sees an empty history.
-- Column names match what the server reads and writes (customer_phone, not phone).
create table if not exists public.wallet_transactions (
  id             bigserial primary key,
  customer_phone text not null,
  type           text not null,          -- 'credit' | 'debit'
  amount         numeric(10,2) not null,
  description    text,
  created_at     timestamptz not null default now()
);

create index if not exists wallet_transactions_customer_idx
  on public.wallet_transactions (customer_phone, created_at desc);

-- Server-only. This is a financial ledger keyed by phone number; the anon key shipped
-- to browsers must never read it. RLS on with no policies denies everything except the
-- service role the API uses.
alter table public.wallet_transactions enable row level security;


-- 2. CAMPAIGN CREDITS — inert until the first-order campaign is switched on, but the
-- pricing engine reads the column on every quote. It is absent today, which is what
-- silently stripped every Prime member's discount once already.
alter table public.customers
  add column if not exists free_order_credits integer not null default 0;


-- 3. WEBSITE LEADS — only needed if the landing-page signup form stays. The campaign
-- is currently paused, so this can wait; without it the form fails for the visitor.
create table if not exists public.leads (
  phone        text primary key,
  name         text,
  consent      boolean not null default false,
  consent_text text,
  consent_at   timestamptz,
  source       text default 'website',
  last_sent_at timestamptz,
  send_count   integer not null default 0,
  unsubscribed boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists leads_sendable_idx
  on public.leads (consent, unsubscribed, last_sent_at);

alter table public.leads enable row level security;
