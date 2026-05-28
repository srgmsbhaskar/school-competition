
-- Tighten certificates SELECT: teachers only see certificates for students in their assigned classes
DROP POLICY IF EXISTS "Users can view relevant certificates" ON storage.objects;

CREATE POLICY "Users can view relevant certificates"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'certificates'
  AND (
    is_admin_or_coordinator(auth.uid())
    OR has_role(auth.uid(), 'department_incharge'::app_role)
    OR (
      has_role(auth.uid(), 'teacher'::app_role)
      AND EXISTS (
        SELECT 1
        FROM public.student_participations sp
        JOIN public.students s ON s.id = sp.student_id
        JOIN public.teacher_assignments ta
          ON ta.teacher_id = auth.uid()
         AND ta.class = s.class
         AND ta.competition_id = sp.competition_id
        WHERE sp.certificate_url IS NOT NULL
          AND sp.certificate_url LIKE '%' || storage.objects.name
      )
    )
  )
);

-- Add explicit SELECT policy for department incharge on student_participations
CREATE POLICY "Dept incharge can view dept participations"
ON public.student_participations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.id = student_participations.competition_id
      AND is_department_incharge(auth.uid(), c.department)
  )
);
