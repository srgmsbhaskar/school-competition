import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'coordinator' | 'teacher' | 'department_incharge';

function getCurrentAcademicYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (month >= 4) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  assignedDepartment: string | null;
  academicYear: string;
  isFrozen: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [assignedDepartment, setAssignedDepartment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);

  const academicYear = getCurrentAcademicYear();

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching role:', error);
        return null;
      }

      return data?.role as AppRole;
    } catch (error) {
      console.error('Error fetching role:', error);
      return null;
    }
  };

  const fetchDepartmentAssignment = async (userId: string) => {
    try {
      const { data } = await (supabase as any)
        .from('department_assignments')
        .select('department')
        .eq('user_id', userId)
        .single();

      return data?.department || null;
    } catch {
      return null;
    }
  };

  const fetchFreezeStatus = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', `freeze_${academicYear}`)
        .single();

      setIsFrozen(data?.value === 'true');
    } catch {
      setIsFrozen(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const userRole = await fetchUserRole(session.user.id);
            setRole(userRole);

            if (userRole === 'department_incharge') {
              const dept = await fetchDepartmentAssignment(session.user.id);
              setAssignedDepartment(dept);
            } else {
              setAssignedDepartment(null);
            }

            if (userRole === 'teacher') {
              await fetchFreezeStatus();
            }

            setIsLoading(false);
          }, 0);
        } else {
          setRole(null);
          setAssignedDepartment(null);
          setIsFrozen(false);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const userRole = await fetchUserRole(session.user.id);
        setRole(userRole);

        if (userRole === 'department_incharge') {
          const dept = await fetchDepartmentAssignment(session.user.id);
          setAssignedDepartment(dept);
        }

        if (userRole === 'teacher') {
          await fetchFreezeStatus();
        }
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setAssignedDepartment(null);
    setIsFrozen(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, assignedDepartment, academicYear, isFrozen, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
