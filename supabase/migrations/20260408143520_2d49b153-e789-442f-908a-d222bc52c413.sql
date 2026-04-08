
-- Allow authenticated users to read freeze-related settings
CREATE POLICY "Authenticated users can read freeze settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key LIKE 'freeze_%');
