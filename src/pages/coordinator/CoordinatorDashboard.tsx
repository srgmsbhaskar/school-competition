import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Calendar, Award, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const CoordinatorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCompetitions: 0,
    upcomingEvents: 0,
    totalParticipants: 0,
    prizesAwarded: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [competitions, participations] = await Promise.all([
        supabase.from('competitions').select('id', { count: 'exact' }),
        supabase.from('student_participations').select('id, prize', { count: 'exact' }),
      ]);

      const prizesCount = participations.data?.filter(p => p.prize && p.prize !== 'participation').length || 0;

      setStats({
        totalCompetitions: competitions.count || 0,
        upcomingEvents: 0,
        totalParticipants: participations.count || 0,
        prizesAwarded: prizesCount,
      });
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Competitions',
      value: stats.totalCompetitions,
      icon: Trophy,
      path: '/coordinator/competitions',
    },
    {
      title: 'Total Participants',
      value: stats.totalParticipants,
      icon: Users,
      path: '/coordinator/reports',
    },
    {
      title: 'Prizes Awarded',
      value: stats.prizesAwarded,
      icon: Award,
      path: '/coordinator/prizes',
    },
  ];

  const quickActions = [
    {
      title: 'Create Competition',
      description: 'Set up a new competition with events',
      icon: Trophy,
      path: '/coordinator/competitions',
    },
    {
      title: 'Assign Teachers',
      description: 'Assign teachers to competition classes',
      icon: Users,
      path: '/coordinator/assign-teachers',
    },
    {
      title: 'View Reports',
      description: 'See participation and prize reports',
      icon: Award,
      path: '/coordinator/reports',
    },
  ];

  return (
    <DashboardLayout title="Coordinator Dashboard">
      <div className="space-y-6 animate-fade-in">
        <div className="grid gap-4 md:grid-cols-3">
          {statCards.map((stat) => (
            <Card
              key={stat.title}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(stat.path)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <h2 className="section-header">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {quickActions.map((action) => (
              <Card
                key={action.title}
                className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                onClick={() => navigate(action.path)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <action.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{action.title}</CardTitle>
                      <CardDescription>{action.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CoordinatorDashboard;
