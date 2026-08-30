-- Email one-time codes: a login route that does not depend on Google or on telecom.
-- Run this in the Supabase SQL editor.
--
-- Phone OTP goes through Firebase, which needs a verified Google Cloud account, and
-- every SMS alternative needs DLT registration with TRAI. Both are document queues
-- outside our control. Email sending verifies a *domain* — a DNS record on
-- pressgo.co.in — so this path can be stood up without waiting on anyone.
--
-- Intended as a fallback for existing customers, not a replacement: it signs a
-- customer in by finding the phone number their email is registered against.

-- Where a customer's email lives. Set by the customer while signed in via phone, so
-- the email is only ever attached to an already-verified account.
alter table public.customers
  add column if not exists email text;

-- One row per email address, replaced on each new request.
create table if not exists public.email_otps (
  email        text primary key,
  -- The code is stored hashed. A readable OTP table is a list of live credentials,
  -- and this one sits next to the customer records it unlocks.
  code_hash    text not null,
  expires_at   timestamptz not null,
  -- Wrong guesses on the current code. Burned after too many, so a six-digit code
  -- cannot be brute-forced within its lifetime.
  attempts     integer not null default 0,
  -- Requests in the current window, to cap how many mails one address can trigger.
  send_count   integer not null default 0,
  window_start timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create unique index if not exists customers_email_idx
  on public.customers (lower(email)) where email is not null;

-- Server-only. These rows are login credentials; the anon key must never read them.
alter table public.email_otps enable row level security;

-- Expired codes are dead weight. Either schedule this or run it occasionally:
--   delete from public.email_otps where expires_at < now() - interval '1 day';
