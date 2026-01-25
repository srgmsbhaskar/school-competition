-- Fix warning-level security issues: restrict visibility of participations and prizes

-- 1. Student Participations: Restrict to admins, coordinators, and assigned teachers
DROP POLICY IF EXISTS "All authenticated users can view participations" ON public.student_participations;

-- Admins and coordinators can view all participations
CREATE POLICY "Admins and coordinators can view all participations"
ON public.student_participations
FOR SELECT
USING (is_admin_or_coordinator(auth.uid()));

-- Teachers can only view participations for students in their assigned classes
CREATE POLICY "Teachers can view participations for assigned students"
ON public.student_participations
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND EXISTS (
    SELECT 1 
    FROM public.teacher_assignments ta
    JOIN public.students s ON s.class = ta.class
    WHERE ta.teacher_id = auth.uid()
      AND s.id = student_participations.student_id
      AND ta.competition_id = student_participations.competition_id
  )
);

-- 2. Competition Prizes: Restrict to admins and coordinators only
DROP POLICY IF EXISTS "All authenticated users can view competition prizes" ON public.competition_prizes;

-- Only admins and coordinators can view competition prizes
CREATE POLICY "Admins and coordinators can view competition prizes"
ON public.competition_prizes
FOR SELECT
USING (is_admin_or_coordinator(auth.uid()));