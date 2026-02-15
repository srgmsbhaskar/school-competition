
-- Create department enum
CREATE TYPE public.competition_department AS ENUM ('external', 'internal', 'sports', 'other');

-- Add department column to competitions with default 'external' for existing data
ALTER TABLE public.competitions 
ADD COLUMN department public.competition_department NOT NULL DEFAULT 'external';
