
-- 1. Scope categories management: remove blanket dept_incharge ALL policy
DROP POLICY IF EXISTS "Dept incharge can manage categories" ON public.categories;

-- 2. Scope students visibility for dept in-charges to their department only
DROP POLICY IF EXISTS "Dept incharge can view students" ON public.students;
CREATE POLICY "Dept incharge can view own dept students"
ON public.students FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.student_participations sp
    JOIN public.competitions c ON c.id = sp.competition_id
    WHERE sp.student_id = students.id
      AND public.is_department_incharge(auth.uid(), c.department)
  )
);

-- 3. Scope user_roles visibility for dept in-charges to users in the same department
DROP POLICY IF EXISTS "Dept incharge can view roles" ON public.user_roles;
CREATE POLICY "Dept incharge can view own dept roles"
ON public.user_roles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.department_assignments my
    JOIN public.department_assignments other ON other.department = my.department
    WHERE my.user_id = auth.uid()
      AND other.user_id = user_roles.user_id
      AND public.has_role(auth.uid(), 'department_incharge'::app_role)
  )
  OR (
    public.has_role(auth.uid(), 'department_incharge'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.teacher_assignments ta
      JOIN public.competitions c ON c.id = ta.competition_id
      WHERE ta.teacher_id = user_roles.user_id
        AND public.is_department_incharge(auth.uid(), c.department)
    )
  )
);

-- 4. Server-side freeze enforcement
CREATE OR REPLACE FUNCTION public.competition_academic_year(_date date)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN EXTRACT(MONTH FROM _date) >= 4
      THEN EXTRACT(YEAR FROM _date)::int::text || '-' || lpad(((EXTRACT(YEAR FROM _date)::int + 1) % 100)::text, 2, '0')
    ELSE (EXTRACT(YEAR FROM _date)::int - 1)::text || '-' || lpad((EXTRACT(YEAR FROM _date)::int % 100)::text, 2, '0')
  END
$$;

CREATE OR REPLACE FUNCTION public.is_year_frozen(_year text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_settings
    WHERE key = 'freeze_' || _year AND value = 'true'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_competition_write_blocked(_competition_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT c.is_frozen OR public.is_year_frozen(public.competition_academic_year(c.competition_date))
     FROM public.competitions c WHERE c.id = _competition_id),
    false
  )
$$;

-- Recreate dept-incharge/teacher write policies with freeze checks
DROP POLICY IF EXISTS "Dept incharge manage own dept competitions" ON public.competitions;
CREATE POLICY "Dept incharge manage own dept competitions"
ON public.competitions FOR ALL TO authenticated
USING (
  public.is_department_incharge(auth.uid(), department)
  AND NOT public.is_year_frozen(public.competition_academic_year(competition_date))
  AND NOT is_frozen
)
WITH CHECK (
  public.is_department_incharge(auth.uid(), department)
  AND NOT public.is_year_frozen(public.competition_academic_year(competition_date))
);

DROP POLICY IF EXISTS "Dept incharge manage own dept events" ON public.events;
CREATE POLICY "Dept incharge manage own dept events"
ON public.events FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.id = events.competition_id
      AND public.is_department_incharge(auth.uid(), c.department)
  )
  AND NOT public.is_competition_write_blocked(events.competition_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.id = events.competition_id
      AND public.is_department_incharge(auth.uid(), c.department)
  )
  AND NOT public.is_competition_write_blocked(events.competition_id)
);

DROP POLICY IF EXISTS "Dept incharge manage own dept event classes" ON public.event_classes;
CREATE POLICY "Dept incharge manage own dept event classes"
ON public.event_classes FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.competitions c ON c.id = e.competition_id
    WHERE e.id = event_classes.event_id
      AND public.is_department_incharge(auth.uid(), c.department)
      AND NOT public.is_competition_write_blocked(c.id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.competitions c ON c.id = e.competition_id
    WHERE e.id = event_classes.event_id
      AND public.is_department_incharge(auth.uid(), c.department)
      AND NOT public.is_competition_write_blocked(c.id)
  )
);

DROP POLICY IF EXISTS "Dept incharge manage own dept participations" ON public.student_participations;
CREATE POLICY "Dept incharge manage own dept participations"
ON public.student_participations FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.id = student_participations.competition_id
      AND public.is_department_incharge(auth.uid(), c.department)
  )
  AND NOT public.is_competition_write_blocked(student_participations.competition_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.id = student_participations.competition_id
      AND public.is_department_incharge(auth.uid(), c.department)
  )
  AND NOT public.is_competition_write_blocked(student_participations.competition_id)
);

DROP POLICY IF EXISTS "Dept incharge manage own dept prizes" ON public.competition_prizes;
CREATE POLICY "Dept incharge manage own dept prizes"
ON public.competition_prizes FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.id = competition_prizes.competition_id
      AND public.is_department_incharge(auth.uid(), c.department)
  )
  AND NOT public.is_competition_write_blocked(competition_prizes.competition_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.id = competition_prizes.competition_id
      AND public.is_department_incharge(auth.uid(), c.department)
  )
  AND NOT public.is_competition_write_blocked(competition_prizes.competition_id)
);

DROP POLICY IF EXISTS "Dept incharge manage own dept teacher assignments" ON public.teacher_assignments;
CREATE POLICY "Dept incharge manage own dept teacher assignments"
ON public.teacher_assignments FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.id = teacher_assignments.competition_id
      AND public.is_department_incharge(auth.uid(), c.department)
  )
  AND NOT public.is_competition_write_blocked(teacher_assignments.competition_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.id = teacher_assignments.competition_id
      AND public.is_department_incharge(auth.uid(), c.department)
  )
  AND NOT public.is_competition_write_blocked(teacher_assignments.competition_id)
);

-- Teachers: block participation writes when competition/year is frozen
DROP POLICY IF EXISTS "Teachers can add participations for their assigned classes" ON public.student_participations;
CREATE POLICY "Teachers can add participations for their assigned classes"
ON public.student_participations FOR INSERT TO authenticated
WITH CHECK (
  (
    EXISTS (
      SELECT 1 FROM public.teacher_assignments ta
      JOIN public.students s ON s.class = ta.class
      WHERE ta.teacher_id = auth.uid()
        AND s.id = student_participations.student_id
        AND ta.competition_id = student_participations.competition_id
    )
    AND NOT public.is_competition_write_blocked(student_participations.competition_id)
  )
  OR public.is_admin_or_coordinator(auth.uid())
);

DROP POLICY IF EXISTS "Teachers can update participations for their assigned classes" ON public.student_participations;
CREATE POLICY "Teachers can update participations for their assigned classes"
ON public.student_participations FOR UPDATE TO authenticated
USING (
  selected_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.teacher_assignments ta
    JOIN public.students s ON s.class = ta.class
    WHERE ta.teacher_id = auth.uid()
      AND s.id = student_participations.student_id
      AND ta.competition_id = student_participations.competition_id
  )
  AND NOT public.is_competition_write_blocked(student_participations.competition_id)
)
WITH CHECK (
  selected_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.teacher_assignments ta
    JOIN public.students s ON s.class = ta.class
    WHERE ta.teacher_id = auth.uid()
      AND s.id = student_participations.student_id
      AND ta.competition_id = student_participations.competition_id
  )
  AND NOT public.is_competition_write_blocked(student_participations.competition_id)
);
