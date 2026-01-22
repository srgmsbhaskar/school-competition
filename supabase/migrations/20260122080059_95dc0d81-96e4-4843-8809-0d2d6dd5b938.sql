-- Allow coordinators to view all user roles (needed for teacher assignment)
CREATE POLICY "Coordinators can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'coordinator'::app_role));