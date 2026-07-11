
DROP POLICY IF EXISTS "Dept incharge can view own dept students" ON public.students;

CREATE POLICY "Dept incharge can view own dept students"
ON public.students FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'department_incharge'::app_role)
  AND (
    EXISTS (
      SELECT 1 FROM public.student_participations sp
      JOIN public.competitions c ON c.id = sp.competition_id
      WHERE sp.student_id = students.id
        AND public.is_department_incharge(auth.uid(), c.department)
    )
    OR EXISTS (
      SELECT 1 FROM public.event_classes ec
      JOIN public.events e ON e.id = ec.event_id
      JOIN public.competitions c ON c.id = e.competition_id
      WHERE ec.class = students.class
        AND public.is_department_incharge(auth.uid(), c.department)
    )
  )
);
