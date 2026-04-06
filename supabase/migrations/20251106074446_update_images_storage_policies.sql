/*
  # Update Images Storage Policies

  1. Policy Updates
    - Allow public (anon) users to upload images
    - Allow public users to update and delete images for setup purposes

  2. Security Note
    - These permissive policies are for initial setup
    - Can be tightened after images are uploaded
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;

-- Allow anyone (including anon) to upload images
CREATE POLICY "Anyone can upload images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'images');

-- Allow anyone to update images
CREATE POLICY "Anyone can update images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'images')
WITH CHECK (bucket_id = 'images');

-- Allow anyone to delete images
CREATE POLICY "Anyone can delete images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'images');