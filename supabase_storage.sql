-- ==========================================
-- SUPABASE STORAGE CONFIGURATION MINIMAL SETUP
-- ==========================================

-- Create buckets for the POS application
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('avatars', 'avatars', true),
  ('product-images', 'product-images', true),
  ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the storage.objects table
-- (RLS is usually enabled by default on storage.objects in Supabase)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Avatars Bucket Policies
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own avatars" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own avatars" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
);

-- Products Bucket Policies
CREATE POLICY "Product images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update product images" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete product images" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
);

-- Business Logos Bucket Policies
CREATE POLICY "Business logos are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'business-logos');

CREATE POLICY "Authenticated users can upload business logos" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'business-logos' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update business logos" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'business-logos' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete business logos" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'business-logos' 
    AND auth.role() = 'authenticated'
);
