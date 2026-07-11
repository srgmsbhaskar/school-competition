
DROP POLICY IF EXISTS "Users can view relevant certificates" ON storage.objects;

CREATE POLICY "Users can view relevant certificates"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'certificates'
  AND (
    public.is_admin_or_coordinator(auth.uid())
    OR public.can_manage_certificate_path(name)
    OR (
      public.has_role(auth.uid(), 'teacher'::public.app_role)
      AND EXISTS (
        SELECT 1
        FROM public.student_participations sp
        JOIN public.students s ON s.id = sp.student_id
        JOIN public.teacher_assignments ta
          ON ta.teacher_id = auth.uid()
         AND ta.class = s.class
         AND ta.competition_id = sp.competition_id
        WHERE sp.certificate_url IS NOT NULL
          AND sp.certificate_url LIKE ('%' || objects.name)
      )
    )
  )
);
