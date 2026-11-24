-- The items on Nagaraj N P's price board that the app's catalogue was missing.
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- DO NOT use the admin "reseed prices" button to apply these. Reseed deletes every
-- garment row and rebuilds the catalogue from a formula (dry clean = 2.5x the ironing
-- price, laundry = 1.5x), and the live prices were tuned away from that formula long
-- ago -- light-weight dry cleaning is 210 live where the formula would give 50. A
-- reseed would wipe the real prices. This insert only adds rows that are absent and
-- leaves every existing price untouched.
--
-- Prices are the customer-facing ones, derived from Nagaraj's cost the same way the
-- rest of the catalogue was: ironing at about twice his rate, dry cleaning lined up
-- with the comparable item already in the list.
--
--   Shirt            his 10 iron / 125 dry clean  -- priced as Trouser/Pant already is
--   Ladies Dress     his 10 iron
--   Ladies Long Top  his 15 iron / 200 dry clean
--   Jubba            his 10 iron
--   Dupatta          his "VEL (HONI)", 10 iron
--   Saree            his 50 iron / 350 dry clean  -- the plain one; Designer and Silk exist
--   Bed Cover        his 40 iron / 150 washing    -- distinct from the Bed Sheet already listed
--   Carpet           his 1000 dry clean for a 6x8 -- dry cleaning only, nobody irons a carpet

insert into public.prices (category, item_name, price, service_type)
select v.category, v.item_name, v.price, v.service_type
from (values
  ('Light Weight',  'Shirt',           20,  'Ironing'),
  ('Light Weight',  'Shirt',           27,  'Laundry'),
  ('Light Weight',  'Shirt',           210, 'Dry Cleaning'),

  ('Light Weight',  'Ladies Dress',    20,  'Ironing'),
  ('Light Weight',  'Ladies Dress',    30,  'Laundry'),
  ('Light Weight',  'Ladies Dress',    210, 'Dry Cleaning'),

  ('Light Weight',  'Ladies Long Top', 30,  'Ironing'),
  ('Light Weight',  'Ladies Long Top', 45,  'Laundry'),
  ('Light Weight',  'Ladies Long Top', 310, 'Dry Cleaning'),

  ('Light Weight',  'Jubba',           20,  'Ironing'),
  ('Light Weight',  'Jubba',           30,  'Laundry'),
  ('Light Weight',  'Jubba',           210, 'Dry Cleaning'),

  ('Light Weight',  'Dupatta',         20,  'Ironing'),
  ('Light Weight',  'Dupatta',         30,  'Laundry'),
  ('Light Weight',  'Dupatta',         210, 'Dry Cleaning'),

  ('Medium/Heavy',  'Saree',           100, 'Ironing'),
  ('Medium/Heavy',  'Saree',           150, 'Laundry'),
  ('Medium/Heavy',  'Saree',           530, 'Dry Cleaning'),

  ('Household',     'Bed Cover',       80,  'Ironing'),
  ('Household',     'Bed Cover',       225, 'Laundry'),
  ('Household',     'Bed Cover',       460, 'Dry Cleaning'),

  -- Dry cleaning only: the customer screen lists an item under a service solely when a
  -- row exists for that pair, so leaving the other two out keeps carpets out of the
  -- ironing and laundry screens entirely.
  ('Household',     'Carpet',          1500, 'Dry Cleaning')
) as v(category, item_name, price, service_type)
where not exists (
  select 1 from public.prices p
  where p.item_name = v.item_name
    and p.service_type = v.service_type
);
