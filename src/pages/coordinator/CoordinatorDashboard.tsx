import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Dumbbell, Globe, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DepartmentCard {
  key: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  count: number;
}

const allDepartments = [
  { key: 'external', title: 'External Competition', description: 'Manage competitions organized by external bodies', icon: Globe },
  { key: 'internal', title: 'Internal Competition', description: 'Manage school-level internal competitions', icon: Trophy },
  { key: 'sports', title: 'Sports', description: 'Manage sports events and competitions', icon: Dumbbell },
  { key: 'other', title: 'Other Competition', description: 'Manage other types of competitions', icon: MoreHorizontal },
];

const departmentColors: Record<string, string> = {
  external: 'bg-blue-500/10 text-blue-700',
  internal: 'bg-purple-500/10 text-purple-700',
  sports: 'bg-emerald-500/10 text-emerald-700',
  other: 'bg-amber-500/10 text-amber-700',
};

const CoordinatorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { role, assignedDepartment } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({
    external: 0, internal: 0, sports: 0, other: 0,
  });

  useEffect(() => {
    // If department_incharge, redirect to their department directly
    if (role === 'department_incharge' && assignedDepartment) {
      navigate(`/coordinator/${assignedDepartment}/competitions`, { replace: true });
      return;
    }

    const fetchCounts = async () => {
      const { data } = await supabase.from('competitions').select('department');
      if (data) {
        const c: Record<string, number> = { external: 0, internal: 0, sports: 0, other: 0 };
        data.forEach((row: any) => {
          if (c[row.department] !== undefined) c[row.department]++;
        });
        setCounts(c);
      }
    };
    fetchCounts();
  }, [role, assignedDepartment, navigate]);

  const departments: DepartmentCard[] = allDepartments.map((dept) => ({
    ...dept,
    path: `/coordinator/${dept.key}/competitions`,
    count: counts[dept.key],
  }));

  return (
    <DashboardLayout title="Coordinator Dashboard">
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-xl font-semibold mb-1">Departments</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Select a department to manage its competitions, events, and reports.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {departments.map((dept) => (
            <Card
              key={dept.key}
              className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary/30"
              onClick={() => navigate(dept.path)}
            >
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${departmentColors[dept.key]}`}>
                    <dept.icon className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{dept.title}</CardTitle>
                    <CardDescription>{dept.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{dept.count}</p>
                <p className="text-xs text-muted-foreground">Competitions</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CoordinatorDashboard;
