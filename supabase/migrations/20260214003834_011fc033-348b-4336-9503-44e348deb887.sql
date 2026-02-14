
-- Add group_number column to student_participations for group events
ALTER TABLE public.student_participations
ADD COLUMN group_number integer NULL;

-- Add index for efficient group queries
CREATE INDEX idx_student_participations_group ON public.student_participations(event_id, group_number);
