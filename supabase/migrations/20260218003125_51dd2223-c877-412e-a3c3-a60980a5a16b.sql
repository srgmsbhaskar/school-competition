
-- Fix ALL policies that are RESTRICTIVE (Permissive: No) to be PERMISSIVE
-- This is the root cause: dept_incharge can't pass ALL restrictive policies simultaneously

-- ===================== COMPETITIONS =====================
DROP POLICY IF EXISTS "Admin and coordinator can manage competitions" ON public.competitions;
DROP POLICY IF EXISTS "All authenticated users can view competitions" ON public.competitions;
DROP POLICY IF EXISTS "Dept incharge manage own dept competitions" ON public.competitions;

CREATE POLICY "Admin and coordinator can manage competitions"
ON public.competitions FOR ALL
TO authenticated
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Dept incharge manage own dept competitions"
ON public.competitions FOR ALL
TO authenticated
USING (is_department_incharge(auth.uid(), department))
WITH CHECK (is_department_incharge(auth.uid(), department));

-- Department-scoped visibility: each user only sees their department's competitions
-- Admins/coordinators see all, dept incharge see only their dept, teachers see all (for assignment)
CREATE POLICY "Authenticated users can view competitions"
ON public.competitions FOR SELECT
TO authenticated
USING (
  is_admin_or_coordinator(auth.uid())
  OR is_department_incharge(auth.uid(), department)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

-- ===================== EVENTS =====================
DROP POLICY IF EXISTS "Admin and coordinator can manage events" ON public.events;
DROP POLICY IF EXISTS "All authenticated users can view events" ON public.events;
DROP POLICY IF EXISTS "Dept incharge manage own dept events" ON public.events;

CREATE POLICY "Admin and coordinator can manage events"
ON public.events FOR ALL
TO authenticated
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Dept incharge manage own dept events"
ON public.events FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM competitions c
  WHERE c.id = events.competition_id
    AND is_department_incharge(auth.uid(), c.department)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM competitions c
  WHERE c.id = events.competition_id
    AND is_department_incharge(auth.uid(), c.department)
));

CREATE POLICY "Authenticated users can view events"
ON public.events FOR SELECT
TO authenticated
USING (true);

-- ===================== EVENT_CLASSES =====================
DROP POLICY IF EXISTS "Admin and coordinator can manage event classes" ON public.event_classes;
DROP POLICY IF EXISTS "All authenticated users can view event classes" ON public.event_classes;
DROP POLICY IF EXISTS "Dept incharge manage own dept event classes" ON public.event_classes;

CREATE POLICY "Admin and coordinator can manage event classes"
ON public.event_classes FOR ALL
TO authenticated
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Dept incharge manage own dept event classes"
ON public.event_classes FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM events e
  JOIN competitions c ON c.id = e.competition_id
  WHERE e.id = event_classes.event_id
    AND is_department_incharge(auth.uid(), c.department)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM events e
  JOIN competitions c ON c.id = e.competition_id
  WHERE e.id = event_classes.event_id
    AND is_department_incharge(auth.uid(), c.department)
));

CREATE POLICY "Authenticated users can view event classes"
ON public.event_classes FOR SELECT
TO authenticated
USING (true);

-- ===================== STUDENT_PARTICIPATIONS =====================
DROP POLICY IF EXISTS "Admin and coordinator can manage all participations" ON public.student_participations;
DROP POLICY IF EXISTS "Admins and coordinators can view all participations" ON public.student_participations;
DROP POLICY IF EXISTS "Dept incharge manage own dept participations" ON public.student_participations;
DROP POLICY IF EXISTS "Teachers can add participations for their assigned classes" ON public.student_participations;
DROP POLICY IF EXISTS "Teachers can view participations for assigned students" ON public.student_participations;

CREATE POLICY "Admin and coordinator can manage all participations"
ON public.student_participations FOR ALL
TO authenticated
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Dept incharge manage own dept participations"
ON public.student_participations FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM competitions c
  WHERE c.id = student_participations.competition_id
    AND is_department_incharge(auth.uid(), c.department)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM competitions c
  WHERE c.id = student_participations.competition_id
    AND is_department_incharge(auth.uid(), c.department)
));

CREATE POLICY "Teachers can view participations for assigned students"
ON public.student_participations FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND EXISTS (
    SELECT 1 FROM teacher_assignments ta
    JOIN students s ON s.class = ta.class
    WHERE ta.teacher_id = auth.uid()
      AND s.id = student_participations.student_id
      AND ta.competition_id = student_participations.competition_id
  )
);

CREATE POLICY "Teachers can add participations for their assigned classes"
ON public.student_participations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM teacher_assignments ta
    JOIN students s ON s.class = ta.class
    WHERE ta.teacher_id = auth.uid()
      AND s.id = student_participations.student_id
      AND ta.competition_id = student_participations.competition_id
  ) OR is_admin_or_coordinator(auth.uid())
);

-- ===================== COMPETITION_PRIZES =====================
DROP POLICY IF EXISTS "Admin and coordinator can manage competition prizes" ON public.competition_prizes;
DROP POLICY IF EXISTS "Admins and coordinators can view competition prizes" ON public.competition_prizes;
DROP POLICY IF EXISTS "Dept incharge manage own dept prizes" ON public.competition_prizes;

CREATE POLICY "Admin and coordinator can manage competition prizes"
ON public.competition_prizes FOR ALL
TO authenticated
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Dept incharge manage own dept prizes"
ON public.competition_prizes FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM competitions c
  WHERE c.id = competition_prizes.competition_id
    AND is_department_incharge(auth.uid(), c.department)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM competitions c
  WHERE c.id = competition_prizes.competition_id
    AND is_department_incharge(auth.uid(), c.department)
));

CREATE POLICY "Admins and coordinators can view competition prizes"
ON public.competition_prizes FOR SELECT
TO authenticated
USING (is_admin_or_coordinator(auth.uid()));

-- ===================== TEACHER_ASSIGNMENTS =====================
DROP POLICY IF EXISTS "Admin and coordinator can manage teacher assignments" ON public.teacher_assignments;
DROP POLICY IF EXISTS "Dept incharge manage own dept teacher assignments" ON public.teacher_assignments;
DROP POLICY IF EXISTS "Teachers can view their assignments" ON public.teacher_assignments;

CREATE POLICY "Admin and coordinator can manage teacher assignments"
ON public.teacher_assignments FOR ALL
TO authenticated
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Dept incharge manage own dept teacher assignments"
ON public.teacher_assignments FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM competitions c
  WHERE c.id = teacher_assignments.competition_id
    AND is_department_incharge(auth.uid(), c.department)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM competitions c
  WHERE c.id = teacher_assignments.competition_id
    AND is_department_incharge(auth.uid(), c.department)
));

CREATE POLICY "Teachers can view their assignments"
ON public.teacher_assignments FOR SELECT
TO authenticated
USING (auth.uid() = teacher_id);

-- ===================== CATEGORIES =====================
DROP POLICY IF EXISTS "Admin and coordinator can manage categories" ON public.categories;
DROP POLICY IF EXISTS "All authenticated users can view categories" ON public.categories;
DROP POLICY IF EXISTS "Dept incharge can view categories" ON public.categories;

CREATE POLICY "Admin and coordinator can manage categories"
ON public.categories FOR ALL
TO authenticated
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Dept incharge can manage categories"
ON public.categories FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'department_incharge'::app_role))
WITH CHECK (has_role(auth.uid(), 'department_incharge'::app_role));

CREATE POLICY "All authenticated users can view categories"
ON public.categories FOR SELECT
TO authenticated
USING (true);
