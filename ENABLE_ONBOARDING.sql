-- Enable Onboarding for new users by allowing inserts

-- 1. Give users the ability to create their profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" 
ON profiles FOR SELECT 
USING (id = auth.uid());

-- 2. Give users the ability to create a business and update it
DROP POLICY IF EXISTS "Users can create a business" ON businesses;
CREATE POLICY "Users can create a business" 
ON businesses FOR INSERT 
WITH CHECK (true);

-- Adding UPDATE policy for businesses
DROP POLICY IF EXISTS "Users can update their own businesses" ON businesses;
CREATE POLICY "Users can update their own businesses" 
ON businesses FOR UPDATE 
USING (id IN (SELECT business_id FROM public.business_users WHERE user_id = auth.uid() AND deleted_at IS NULL));

-- 3. Give users the ability to link themselves to a business they just created
DROP POLICY IF EXISTS "Users can link themselves" ON business_users;
CREATE POLICY "Users can link themselves" 
ON business_users FOR INSERT 
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own business_users" ON business_users;
CREATE POLICY "Users can view their own business_users" 
ON business_users FOR SELECT 
USING (user_id = auth.uid());

-- 4. Give users the ability to create a role in their business
DROP POLICY IF EXISTS "Users can create roles" ON roles;
CREATE POLICY "Users can create roles" 
ON roles FOR INSERT 
WITH CHECK (true); -- Relaxed for onboarding

-- 5. Give users the ability to create a branch in their business
DROP POLICY IF EXISTS "Users can create branches" ON branches;
CREATE POLICY "Users can create branches" 
ON branches FOR INSERT 
WITH CHECK (true); -- Relaxed for onboarding

-- 6. Relax Categories and Subscriptions for onboarding
DROP POLICY IF EXISTS "Users can create categories" ON categories;
CREATE POLICY "Users can create categories" 
ON categories FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can create subscriptions" ON subscriptions;
CREATE POLICY "Users can create subscriptions" 
ON subscriptions FOR INSERT 
WITH CHECK (true);

-- Note: Ensure profiles table has RLS enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

