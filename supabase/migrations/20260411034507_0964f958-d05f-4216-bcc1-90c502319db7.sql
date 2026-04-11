
-- Remove direct client INSERT policy
DROP POLICY IF EXISTS "Authenticated can insert own audit logs" ON public.audit_logs;

-- Create a SECURITY DEFINER function for audit logging
CREATE OR REPLACE FUNCTION public.log_audit(
  _action text,
  _details text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, user_email, action, details)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    _action,
    _details
  );
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.log_audit(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text) TO authenticated;
