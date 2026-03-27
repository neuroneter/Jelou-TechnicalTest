-- Jelou B2B Backoffice - Seed Data
-- ==================================

USE jelou_b2b;

-- Seed customers
INSERT INTO customers (name, email, phone) VALUES
  ('ACME Corp', 'ops@acme.com', '+1-555-0100'),
  ('Globex Inc', 'orders@globex.com', '+1-555-0200'),
  ('Initech LLC', 'purchasing@initech.com', '+1-555-0300'),
  ('Umbrella Corp', 'supply@umbrella.com', '+1-555-0400'),
  ('Stark Industries', 'logistics@stark.com', '+1-555-0500');

-- Seed products
INSERT INTO products (sku, name, price_cents, stock) VALUES
  ('WIDGET-001', 'Standard Widget', 49900, 100),
  ('WIDGET-PRO', 'Pro Widget', 129900, 50),
  ('GADGET-001', 'Basic Gadget', 29900, 200),
  ('GADGET-DLX', 'Deluxe Gadget', 199900, 30),
  ('SUPPLY-001', 'Office Supply Pack', 15900, 500),
  ('SUPPLY-PRO', 'Pro Supply Pack', 45900, 150);
