CREATE OR REPLACE FUNCTION public.can_view_competition(_competition_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin_or_coordinator(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = _competition_id
        AND public.is_department_incharge(auth.uid(), c.department)
    )
    OR EXISTS (
      SELECT 1 FROM public.teacher_assignments ta
      WHERE ta.competition_id = _competition_id
        AND ta.teacher_id = auth.uid()
    )
$$;

DROP POLICY IF EXISTS "Authenticated users can view events" ON public.events;
CREATE POLICY "Scoped users can view events"
ON public.events FOR SELECT TO authenticated
USING (public.can_view_competition(competition_id));

DROP POLICY IF EXISTS "Authenticated users can view event classes" ON public.event_classes;
CREATE POLICY "Scoped users can view event classes"
ON public.event_classes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.events e
  WHERE e.id = event_classes.event_id
    AND public.can_view_competition(e.competition_id)
));