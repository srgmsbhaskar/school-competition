
-- 1. Revoke direct INSERT on audit_logs from authenticated role.
-- Writes happen exclusively via the SECURITY DEFINER log_audit() function.
REVOKE INSERT ON public.audit_logs FROM authenticated, anon, public;

-- Also add an explicit restrictive policy so even if grants change, only the
-- definer function (running as the owner role) can insert.
DROP POLICY IF EXISTS "No direct inserts on audit_logs" ON public.audit_logs;
CREATE POLICY "No direct inserts on audit_logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

-- 2. Storage: replace the broad dept_incharge certificate write policies with
-- ones that verify the file path corresponds to a participation in a
-- competition the user actually manages. File naming convention is
-- "{participation_id}.{ext}".

DROP POLICY IF EXISTS "Admins coordinators dept_incharge can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admin and coordinator can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admin and coordinator can update certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admin and coordinator can delete certificates" ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete certificates" ON storage.objects;

-- Helper: returns true if the given object name belongs to a competition the
-- user manages (admin/coordinator always true; dept_incharge only for their
-- department).
CREATE OR REPLACE FUNCTION public.can_manage_certificate_path(_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _participation_id uuid;
BEGIN
  IF public.is_admin_or_coordinator(auth.uid()) THEN
    RETURN true;
  END IF;

  BEGIN
    _participation_id := split_part(_name, '.', 1)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  RETURN EXISTS (
    SELECT 1
    FROM public.student_participations sp
    JOIN public.competitions c ON c.id = sp.competition_id
    WHERE sp.id = _participation_id
      AND public.is_department_incharge(auth.uid(), c.department)
  );
END;
$$;

CREATE POLICY "Managers can upload scoped certificates"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'certificates'
    AND public.can_manage_certificate_path(name)
  );

CREATE POLICY "Managers can update scoped certificates"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'certificates'
    AND public.can_manage_certificate_path(name)
  )
  WITH CHECK (
    bucket_id = 'certificates'
    AND public.can_manage_certificate_path(name)
  );

CREATE POLICY "Managers can delete scoped certificates"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'certificates'
    AND public.can_manage_certificate_path(name)
  );
