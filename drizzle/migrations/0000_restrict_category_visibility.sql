DROP POLICY IF EXISTS "All authenticated users can view categories" ON public.categories;
CREATE POLICY "Competition staff can view categories"
ON public.categories FOR SELECT
TO authenticated
USING (
  public.is_admin_or_coordinator(auth.uid())
  OR public.has_role(auth.uid(), 'department_incharge'::public.app_role)
);