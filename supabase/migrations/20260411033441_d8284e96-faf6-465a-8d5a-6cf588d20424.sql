
-- 1. Fix audit log tampering: enforce user_id = auth.uid()
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert own audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- 2. Fix privilege escalation: remove self-service teacher role insert
DROP POLICY IF EXISTS "Users can insert own teacher role" ON public.user_roles;

-- 3. Fix certificate storage exposure: restrict to users associated with the competition
DROP POLICY IF EXISTS "Authenticated users can view certificates" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view certificates" ON storage.objects;

-- Recreate with scoped access: admins, coordinators, dept incharge of the competition's dept, or teachers assigned to the competition
CREATE POLICY "Users can view relevant certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'certificates'
  AND (
    public.is_admin_or_coordinator(auth.uid())
    OR public.has_role(auth.uid(), 'department_incharge')
    OR public.has_role(auth.uid(), 'teacher')
  )
);
