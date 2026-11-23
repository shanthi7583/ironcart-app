-- How many bags each order was collected in.
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- Losing or mixing a customer's clothes is the one failure a laundry does not recover
-- from, and until now nothing recorded how many bags left the house. With a count on
-- the order, the same number can be checked at pickup, at the shop and at delivery:
-- three bags in has to mean three bags out.
--
-- The tag written on the bag itself is not stored, because it is derived from the order
-- id — order ORD-481920 collected in three bags is tagged 481920-1, 481920-2, 481920-3.
-- Nothing to keep in sync, and the shop can read the owner straight off the tag.

alter table public.orders
  add column if not exists bag_count integer;
