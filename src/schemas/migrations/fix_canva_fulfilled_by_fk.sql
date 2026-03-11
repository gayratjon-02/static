-- Fix: fulfilled_by references admin_users instead of users
-- Admin IDs are in admin_users table, not users table

ALTER TABLE canva_orders DROP CONSTRAINT IF EXISTS canva_orders_fulfilled_by_fkey;
ALTER TABLE canva_orders ADD CONSTRAINT canva_orders_fulfilled_by_fkey
  FOREIGN KEY (fulfilled_by) REFERENCES admin_users(_id);
