
CREATE POLICY "Teachers can update participations for their assigned classes"
ON public.student_participations
FOR UPDATE
TO authenticated
USING (
  selected_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM teacher_assignments ta
    JOIN students s ON s.class = ta.class
    WHERE ta.teacher_id = auth.uid()
      AND s.id = student_participations.student_id
      AND ta.competition_id = student_participations.competition_id
  )
)
WITH CHECK (
  selected_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM teacher_assignments ta
    JOIN students s ON s.class = ta.class
    WHERE ta.teacher_id = auth.uid()
      AND s.id = student_participations.student_id
      AND ta.competition_id = student_participations.competition_id
  )
);
