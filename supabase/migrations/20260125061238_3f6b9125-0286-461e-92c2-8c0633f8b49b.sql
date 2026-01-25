-- Fix: Restrict coordinator profile access to avoid unnecessary email exposure
-- Coordinators should only see profiles of teachers they work with, not all users

-- Drop the overly permissive coordinator SELECT policy
DROP POLICY IF EXISTS "Coordinators can view all profiles" ON public.profiles;

-- Create a more restrictive policy for coordinators
-- Coordinators can only view profiles of teachers who have assignments
CREATE POLICY "Coordinators can view teacher profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'coordinator'::app_role) 
  AND EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    WHERE ur.user_id = profiles.id 
      AND ur.role = 'teacher'::app_role
  )
);