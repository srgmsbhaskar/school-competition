
-- 1. Create department_assignments table
CREATE TABLE public.department_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  department public.competition_department NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.department_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage department assignments"
ON public.department_assignments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own dept assignment"
ON public.department_assignments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Coordinators can view all dept assignments"
ON public.department_assignments FOR SELECT
USING (has_role(auth.uid(), 'coordinator'::app_role));

-- 2. Department incharge helper function
CREATE OR REPLACE FUNCTION public.is_department_incharge(_user_id uuid, _department competition_department)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.department_assignments da ON da.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'department_incharge'
      AND da.department = _department
  )
$$;

-- 3. RLS policies for department_incharge on various tables
CREATE POLICY "Dept incharge manage own dept competitions"
ON public.competitions FOR ALL
USING (is_department_incharge(auth.uid(), department));

CREATE POLICY "Dept incharge manage own dept events"
ON public.events FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.competitions c
  WHERE c.id = events.competition_id
  AND is_department_incharge(auth.uid(), c.department)
));

CREATE POLICY "Dept incharge manage own dept event classes"
ON public.event_classes FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.events e
  JOIN public.competitions c ON c.id = e.competition_id
  WHERE e.id = event_classes.event_id
  AND is_department_incharge(auth.uid(), c.department)
));

CREATE POLICY "Dept incharge manage own dept participations"
ON public.student_participations FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.competitions c
  WHERE c.id = student_participations.competition_id
  AND is_department_incharge(auth.uid(), c.department)
));

CREATE POLICY "Dept incharge manage own dept teacher assignments"
ON public.teacher_assignments FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.competitions c
  WHERE c.id = teacher_assignments.competition_id
  AND is_department_incharge(auth.uid(), c.department)
));

CREATE POLICY "Dept incharge manage own dept prizes"
ON public.competition_prizes FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.competitions c
  WHERE c.id = competition_prizes.competition_id
  AND is_department_incharge(auth.uid(), c.department)
));

-- 4. Allow department_incharge to view profiles, roles, students, categories
CREATE POLICY "Dept incharge can view profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'department_incharge'::app_role));

CREATE POLICY "Dept incharge can view roles"
ON public.user_roles FOR SELECT
USING (has_role(auth.uid(), 'department_incharge'::app_role));

CREATE POLICY "Dept incharge can view students"
ON public.students FOR SELECT
USING (has_role(auth.uid(), 'department_incharge'::app_role));

CREATE POLICY "Dept incharge can view categories"
ON public.categories FOR SELECT
USING (has_role(auth.uid(), 'department_incharge'::app_role));

-- 5. Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view audit logs"
ON public.audit_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Add certificate_url to student_participations
ALTER TABLE public.student_participations ADD COLUMN IF NOT EXISTS certificate_url TEXT;

-- 7. Make certificates bucket public
UPDATE storage.buckets SET public = true WHERE id = 'certificates';

-- 8. Storage policies for certificates
CREATE POLICY "Auth users can upload certificates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'certificates' AND auth.uid() IS NOT NULL);

CREATE POLICY "Public can view certificates"
ON storage.objects FOR SELECT
USING (bucket_id = 'certificates');

CREATE POLICY "Managers can delete certificates"
ON storage.objects FOR DELETE
USING (bucket_id = 'certificates' AND (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'coordinator'::app_role) OR
  has_role(auth.uid(), 'department_incharge'::app_role)
));

-- 9. Allow teacher self-signup to insert own role
CREATE POLICY "Users can insert own teacher role"
ON public.user_roles FOR INSERT
WITH CHECK (auth.uid() = user_id AND role = 'teacher'::app_role);
