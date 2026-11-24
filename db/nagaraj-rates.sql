-- Nagaraj N P's own price board, as the app's whole catalogue.
-- 18 items, 26 price rows. Owner's number on the board: 9964466253.
--
-- These are HIS rates, not PressGo's. Use this only where he keeps the money the
-- customer pays -- there is no margin in these numbers for anyone else. His community
-- already knows these prices, which is the point: a shirt is ten rupees on his board
-- and has to be ten rupees in the app.
--
-- To go back to PressGo's own prices, run restore-pressgo-prices.sql.
--
-- An item appears under a service only where his board quotes one, so most carry
-- ironing alone and some only dry cleaning. The customer screen lists an item under a
-- service only when a row exists, so nothing offers a price he never gave.
--
-- Two names were tidied from the board's spelling: "PILLO COVER" and "LADIEES LONG
-- TOP". His "CARTON" is read as Curtain, which is what it costs to dry clean one.

delete from public.prices where category <> 'system';

insert into public.prices (category, item_name, price, service_type) values
  ('Light Weight', 'Shirt', 10, 'Ironing'),
  ('Light Weight', 'Shirt', 30, 'Laundry'),
  ('Light Weight', 'Shirt', 125, 'Dry Cleaning'),
  ('Light Weight', 'Pant', 10, 'Ironing'),
  ('Light Weight', 'Pant', 30, 'Laundry'),
  ('Light Weight', 'Pant', 125, 'Dry Cleaning'),
  ('Light Weight', 'Ladies Dress', 10, 'Ironing'),
  ('Light Weight', 'Kurta & Pyjama', 10, 'Ironing'),
  ('Light Weight', 'Children''s Pant & Shirt', 10, 'Ironing'),
  ('Light Weight', 'Jubba', 10, 'Ironing'),
  ('Light Weight', 'Ladies Long Top', 15, 'Ironing'),
  ('Light Weight', 'Ladies Long Top', 200, 'Dry Cleaning'),
  ('Light Weight', 'Vel (Honi)', 10, 'Ironing'),
  ('Light Weight', 'Pillow Cover', 10, 'Ironing'),
  ('Medium/Heavy', 'Saree', 50, 'Ironing'),
  ('Medium/Heavy', 'Saree', 350, 'Dry Cleaning'),
  ('Medium/Heavy', 'Suit Pair', 100, 'Ironing'),
  ('Medium/Heavy', 'Suit Pair', 350, 'Dry Cleaning'),
  ('Medium/Heavy', 'Langa', 500, 'Dry Cleaning'),
  ('Medium/Heavy', 'Panche (Dhoti)', 150, 'Dry Cleaning'),
  ('Medium/Heavy', 'Jarkin (Jacket)', 150, 'Dry Cleaning'),
  ('Household', 'Bed Cover', 40, 'Ironing'),
  ('Household', 'Bed Cover', 150, 'Laundry'),
  ('Household', 'Single Blanket', 300, 'Dry Cleaning'),
  ('Household', 'Carpet (Mat)', 1000, 'Dry Cleaning'),
  ('Household', 'Curtain', 350, 'Dry Cleaning');
