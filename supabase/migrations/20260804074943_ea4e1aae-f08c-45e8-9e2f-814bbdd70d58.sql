ALTER TYPE public.prize_type ADD VALUE IF NOT EXISTS 'fourth';
ALTER TYPE public.prize_type ADD VALUE IF NOT EXISTS 'fifth';

ALTER TABLE public.student_participations
  ADD COLUMN IF NOT EXISTS house text;

ALTER TABLE public.student_participations
  DROP CONSTRAINT IF EXISTS student_participations_house_check;
ALTER TABLE public.student_participations
  ADD CONSTRAINT student_participations_house_check
  CHECK (house IS NULL OR house IN ('Mythreyan','Nachiketas','Upakosalan','Vysampayanan','Sathyakaman'));

CREATE TABLE IF NOT EXISTS public.event_prize_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  prize text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, prize)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_prize_points TO authenticated;
GRANT ALL ON public.event_prize_points TO service_role;

ALTER TABLE public.event_prize_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View event prize points" ON public.event_prize_points;
CREATE POLICY "View event prize points" ON public.event_prize_points
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_prize_points.event_id
      AND public.can_view_competition(e.competition_id)
  )
);

DROP POLICY IF EXISTS "Manage event prize points" ON public.event_prize_points;
CREATE POLICY "Manage event prize points" ON public.event_prize_points
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.competitions c ON c.id = e.competition_id
    WHERE e.id = event_prize_points.event_id
      AND (
        public.is_admin_or_coordinator(auth.uid())
        OR public.is_department_incharge(auth.uid(), c.department)
      )
      AND (
        public.has_role(auth.uid(), 'admin')
        OR NOT public.is_competition_write_blocked(c.id)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.competitions c ON c.id = e.competition_id
    WHERE e.id = event_prize_points.event_id
      AND (
        public.is_admin_or_coordinator(auth.uid())
        OR public.is_department_incharge(auth.uid(), c.department)
      )
      AND (
        public.has_role(auth.uid(), 'admin')
        OR NOT public.is_competition_write_blocked(c.id)
      )
  )
);

CREATE TRIGGER update_event_prize_points_updated_at
BEFORE UPDATE ON public.event_prize_points
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();