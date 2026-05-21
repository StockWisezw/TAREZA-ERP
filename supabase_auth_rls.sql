-- ==========================================
-- SUPABASE AUTHENTICATION & RLS SETUP
-- ==========================================

-- 1. Ensure Profiles table has email (for easy login/sync)
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 2. Trigger to automatically create a profile when a new user signs up in Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', Split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Enable Row Level Security (RLS) on all tables required for the application
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cash_drawer_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Set RLS Policies
-- NOTE: For a multi-tenant production app, these should be hardened to check 
-- the business_id against the business_users table for the current auth.uid().
-- For ease of seamless onboarding during migration, we provide authenticated-level access below.

-- Profiles:
CREATE POLICY "Enable read access for authenticated users" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable update for users based on id" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Enable insert for authenticated users" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Base permissive policies for all other tables (Users must be logged in to read/write)
-- You can later harden these by replacing `USING (true)` with:
-- `USING (business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid()))`

CREATE POLICY "Allow authenticated full access to businesses" ON businesses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to branches" ON branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to roles" ON roles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to role_permissions" ON role_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to business_users" ON business_users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to categories" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to inventory" ON inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to suppliers" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to sales" ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to expense_categories" ON expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to cash_drawer_logs" ON cash_drawer_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to subscriptions" ON subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);
