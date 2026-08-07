-- Website leads and the first-order campaign.
-- Run this in the Supabase SQL editor.

-- People who gave their contact details on the website but have not ordered yet.
-- consent/consent_text are recorded because a marketing message sent without a
-- recorded opt-in is what gets a sender number reported and banned — and under the
-- WhatsApp Business Policy, opt-in is a requirement rather than a nicety.
create table if not exists public.leads (
  phone            text primary key,
  name             text,
  consent          boolean not null default false,
  consent_text     text,                        -- the exact wording they agreed to
  consent_at       timestamptz,
  source           text default 'website',
  last_sent_at     timestamptz,                 -- drives the send-frequency throttle
  send_count       integer not null default 0,
  unsubscribed     boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists leads_sendable_idx
  on public.leads (consent, unsubscribed, last_sent_at);

-- Server-only: leads hold names and phone numbers, and the anon key must never read
-- them. RLS on with no policies denies everything except the service role.
alter table public.leads enable row level security;

-- How many campaign "free order" credits this customer has left. The campaign gives
-- two, each worth up to a capped amount off one order. Stored on the customer rather
-- than inferred from order history so redemption is explicit and auditable.
alter table public.customers
  add column if not exists free_order_credits integer not null default 0;

-- From earlier work, included here so it is not missed again: push notifications
-- cannot deliver without it.
alter table public.customers
  add column if not exists fcm_token text;
