-- Create event_type enum
CREATE TYPE public.event_type AS ENUM ('solo', 'group');

-- Add event_type column to events table
ALTER TABLE public.events ADD COLUMN event_type event_type NOT NULL DEFAULT 'solo';

-- Create competition_prizes table for competition-level prizes (Winner, Runner up 1, Runner up 2)
CREATE TABLE public.competition_prizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  prize TEXT NOT NULL CHECK (prize IN ('winner', 'runner_up_1', 'runner_up_2')),
  awarded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(competition_id, prize)
);

-- Enable RLS on competition_prizes
ALTER TABLE public.competition_prizes ENABLE ROW LEVEL SECURITY;

-- RLS policies for competition_prizes
CREATE POLICY "Admin and coordinator can manage competition prizes"
ON public.competition_prizes
FOR ALL
USING (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "All authenticated users can view competition prizes"
ON public.competition_prizes
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_competition_prizes_updated_at
BEFORE UPDATE ON public.competition_prizes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();