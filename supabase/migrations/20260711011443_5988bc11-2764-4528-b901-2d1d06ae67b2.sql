
-- Restore broad student visibility for department in-charges so they can select
-- students for competitions/events (previous scoped policy hid students not yet
-- linked to a participation or event class, breaking selection screens).
DROP POLICY IF EXISTS "Dept incharge can view own dept students" ON public.students;
CREATE POLICY "Dept incharge can view all students"
ON public.students FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'department_incharge'::app_role));
