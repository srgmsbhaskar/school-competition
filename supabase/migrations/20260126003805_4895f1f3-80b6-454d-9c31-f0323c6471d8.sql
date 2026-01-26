-- Fix certificates bucket: Make it private and require authentication

-- Update the bucket to be private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'certificates';

-- Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view certificates" ON storage.objects;

-- Create new policy requiring authentication for viewing certificates
CREATE POLICY "Authenticated users can view certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'certificates');
