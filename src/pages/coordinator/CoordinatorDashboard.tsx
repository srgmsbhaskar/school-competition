import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Dumbbell, Globe, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface DepartmentCard {
  key: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  count: number;
}

const CoordinatorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>({
    external: 0,
    internal: 0,
    sports: 0,
    other: 0,
  });

  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase
        .from('competitions')
        .select('department');

      if (data) {
        const c: Record<string, number> = { external: 0, internal: 0, sports: 0, other: 0 };
        data.forEach((row: any) => {
          if (c[row.department] !== undefined) c[row.department]++;
        });
        setCounts(c);
      }
    };
    fetchCounts();
  }, []);

  const departments: DepartmentCard[] = [
    {
      key: 'external',
      title: 'External Competition',
      description: 'Manage competitions organized by external bodies',
      icon: Globe,
      path: '/coordinator/external/competitions',
      count: counts.external,
    },
    {
      key: 'internal',
      title: 'Internal Competition',
      description: 'Manage school-level internal competitions',
      icon: Trophy,
      path: '/coordinator/internal/competitions',
      count: counts.internal,
    },
    {
      key: 'sports',
      title: 'Sports',
      description: 'Manage sports events and competitions',
      icon: Dumbbell,
      path: '/coordinator/sports/competitions',
      count: counts.sports,
    },
    {
      key: 'other',
      title: 'Other Competition',
      description: 'Manage other types of competitions',
      icon: MoreHorizontal,
      path: '/coordinator/other/competitions',
      count: counts.other,
    },
  ];

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
              className="cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all"
              onClick={() => navigate(dept.path)}
            >
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                    <dept.icon className="h-7 w-7 text-primary" />
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
