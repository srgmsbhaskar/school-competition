
-- Fix 3: Make certificates bucket private
UPDATE storage.buckets SET public = false WHERE id = 'certificates';

-- Drop the public view policy on certificates
DROP POLICY IF EXISTS "Public can view certificates" ON storage.objects;

-- Drop and recreate view policy for certificates
DROP POLICY IF EXISTS "Authenticated users can view certificates" ON storage.objects;
CREATE POLICY "Authenticated users can view certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'certificates');

-- Restrict certificate uploads to admin/coordinator/dept_incharge only
DROP POLICY IF EXISTS "Auth users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admins coordinators dept_incharge can upload certificates" ON storage.objects;
CREATE POLICY "Admins coordinators dept_incharge can upload certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'certificates'
  AND (
    is_admin_or_coordinator(auth.uid())
    OR has_role(auth.uid(), 'department_incharge'::app_role)
  )
);
