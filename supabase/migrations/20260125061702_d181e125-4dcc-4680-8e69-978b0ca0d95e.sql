-- Fix: Restrict student data access to prevent PII exposure
-- Students should only be viewable by admins, coordinators, and teachers assigned to their class

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "All authenticated users can view students" ON public.students;

-- Create restrictive policy: admins and coordinators can view all students
CREATE POLICY "Admins and coordinators can view all students"
ON public.students
FOR SELECT
USING (is_admin_or_coordinator(auth.uid()));

-- Create policy: teachers can only view students in their assigned classes
CREATE POLICY "Teachers can view students in their assigned classes"
ON public.students
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND EXISTS (
    SELECT 1 
    FROM public.teacher_assignments ta
    WHERE ta.teacher_id = auth.uid()
      AND ta.class = students.class
  )
);