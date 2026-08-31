-- Who is bringing the order back, and roughly when.
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- "Where are my clothes and when do I get them?" is the question order tracking
-- exists to answer. With one rider, a phone number and an ETA answer it better than a
-- moving dot on a map — and cost nothing in permissions, Play Store review, or a
-- dependency on the Google account currently under verification.

alter table public.orders
  add column if not exists rider_name text;

alter table public.orders
  add column if not exists rider_phone text;

-- Free text rather than a timestamp on purpose: in practice this is set verbally
-- ("about 20 minutes", "after 6pm"), and forcing a precise time would either be
-- guessed or left blank.
alter table public.orders
  add column if not exists eta text;
