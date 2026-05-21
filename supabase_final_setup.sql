-- ==========================================
-- SUPABASE REALTIME, TRIGGERS, AND INDEXES
-- ==========================================

-- 1. REALTIME CONFIGURATION
-- The app uses Realtime subscriptions for 'products' and 'suppliers'.
-- We need to enable them on the 'supabase_realtime' publication.
begin;
  -- Remove the standard realtime publication if it exists to safely recreate or alter
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

-- Add the specific tables that the app's frontend listens to:
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table suppliers;
-- Optionally, add others like inventory or sales if required later
-- alter publication supabase_realtime add table inventory;


-- 2. AUTOMATIC TIMESTAMP TRIGGERS
-- Create a generic function to update the 'updated_at' column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to all tables that have an 'updated_at' column
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_business_users_updated_at BEFORE UPDATE ON business_users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


-- 3. PERFORMANCE INDEXES
-- Create indexes on frequently queried foreign keys to speed up joins and filters
CREATE INDEX IF NOT EXISTS idx_businesses_users_user_id ON business_users(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_users_business_id ON business_users(business_id);

CREATE INDEX IF NOT EXISTS idx_branches_business_id ON branches(business_id);
CREATE INDEX IF NOT EXISTS idx_roles_business_id ON roles(business_id);

CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_inventory_business_id ON inventory(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_branch_id ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);

CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON suppliers(business_id);

CREATE INDEX IF NOT EXISTS idx_sales_business_id ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
