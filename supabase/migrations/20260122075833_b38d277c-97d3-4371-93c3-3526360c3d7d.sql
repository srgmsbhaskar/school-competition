-- Allow coordinators to view all profiles (needed for teacher assignment)
CREATE POLICY "Coordinators can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'coordinator'::app_role));