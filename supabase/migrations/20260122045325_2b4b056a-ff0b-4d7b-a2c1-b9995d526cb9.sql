-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'coordinator', 'teacher');

-- Create enum for prize types
CREATE TYPE public.prize_type AS ENUM ('participation', 'first', 'second', 'runner_up_1', 'runner_up_2', 'third', 'consolation', 'champion', 'other');

-- Create profiles table for user info
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Create students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  s_no INTEGER NOT NULL,
  admission_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  dob DATE NOT NULL,
  class INTEGER NOT NULL CHECK (class >= 1 AND class <= 12),
  section TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create competitions table
CREATE TABLE public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  competition_date DATE NOT NULL,
  venue TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  certificate_template_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create event_classes table (which classes can participate in an event)
CREATE TABLE public.event_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  class INTEGER NOT NULL CHECK (class >= 1 AND class <= 12),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (event_id, class)
);

-- Create teacher_assignments table (which teacher is assigned to which class for competition)
CREATE TABLE public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE NOT NULL,
  class INTEGER NOT NULL CHECK (class >= 1 AND class <= 12),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (teacher_id, competition_id, class)
);

-- Create student_participations table
CREATE TABLE public.student_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE NOT NULL,
  selected_by UUID REFERENCES auth.users(id),
  prize prize_type,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (student_id, event_id)
);

-- Create app_settings table for admin settings
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is admin or coordinator
CREATE OR REPLACE FUNCTION public.is_admin_or_coordinator(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'coordinator')
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Students policies
CREATE POLICY "All authenticated users can view students"
  ON public.students FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage students"
  ON public.students FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Competitions policies
CREATE POLICY "All authenticated users can view competitions"
  ON public.competitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and coordinator can manage competitions"
  ON public.competitions FOR ALL
  USING (public.is_admin_or_coordinator(auth.uid()));

-- Categories policies
CREATE POLICY "All authenticated users can view categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and coordinator can manage categories"
  ON public.categories FOR ALL
  USING (public.is_admin_or_coordinator(auth.uid()));

-- Events policies
CREATE POLICY "All authenticated users can view events"
  ON public.events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and coordinator can manage events"
  ON public.events FOR ALL
  USING (public.is_admin_or_coordinator(auth.uid()));

-- Event classes policies
CREATE POLICY "All authenticated users can view event classes"
  ON public.event_classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and coordinator can manage event classes"
  ON public.event_classes FOR ALL
  USING (public.is_admin_or_coordinator(auth.uid()));

-- Teacher assignments policies
CREATE POLICY "Teachers can view their assignments"
  ON public.teacher_assignments FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "Admin and coordinator can manage teacher assignments"
  ON public.teacher_assignments FOR ALL
  USING (public.is_admin_or_coordinator(auth.uid()));

-- Student participations policies
CREATE POLICY "All authenticated users can view participations"
  ON public.student_participations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers can add participations for their assigned classes"
  ON public.student_participations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teacher_assignments ta
      JOIN public.students s ON s.class = ta.class
      WHERE ta.teacher_id = auth.uid()
        AND s.id = student_id
        AND ta.competition_id = competition_id
    )
    OR public.is_admin_or_coordinator(auth.uid())
  );

CREATE POLICY "Admin and coordinator can manage all participations"
  ON public.student_participations FOR ALL
  USING (public.is_admin_or_coordinator(auth.uid()));

-- App settings policies
CREATE POLICY "All authenticated can view settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage settings"
  ON public.app_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_competitions_updated_at
  BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_participations_updated_at
  BEFORE UPDATE ON public.student_participations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.categories (name) VALUES 
  ('Junior'),
  ('Senior'),
  ('Sub-Junior'),
  ('Open');

-- Create storage bucket for certificate templates
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', true);

-- Storage policies for certificates
CREATE POLICY "Anyone can view certificates"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'certificates');

CREATE POLICY "Admin and coordinator can upload certificates"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'certificates' AND public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admin and coordinator can update certificates"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'certificates' AND public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admin and coordinator can delete certificates"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'certificates' AND public.is_admin_or_coordinator(auth.uid()));