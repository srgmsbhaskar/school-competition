-- Drop the overly permissive policy that allows all authenticated users to view settings
DROP POLICY IF EXISTS "All authenticated can view settings" ON public.app_settings;

-- Create a more restrictive policy that only allows admins to view settings
CREATE POLICY "Only admins can view settings" 
ON public.app_settings 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));