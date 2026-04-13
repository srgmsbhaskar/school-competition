import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Calendar, MapPin, FileText, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FrozenBanner } from '@/components/FrozenBanner';

interface AssignedCompetition {
  id: string;
  name: string;
  competition_date: string;
  venue: string;
  is_completed: boolean;
  assigned_classes: number[];
}

const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<AssignedCompetition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAssignedCompetitions = async () => {
      if (!user) return;

      // Get teacher assignments
      const { data: assignments } = await supabase
        .from('teacher_assignments')
        .select('competition_id, class')
        .eq('teacher_id', user.id);

      if (!assignments || assignments.length === 0) {
        setIsLoading(false);
        return;
      }

      // Get unique competition IDs
      const competitionIds = [...new Set(assignments.map((a) => a.competition_id))];

      // Get competition details
      const { data: competitionsData } = await supabase
        .from('competitions')
        .select('*')
        .in('id', competitionIds)
        .order('competition_date', { ascending: false });

      const result: AssignedCompetition[] = (competitionsData || []).map((c) => ({
        ...c,
        assigned_classes: assignments
          .filter((a) => a.competition_id === c.id)
          .map((a) => a.class)
          .sort((a, b) => a - b),
      }));

      setCompetitions(result);
      setIsLoading(false);
    };

    fetchAssignedCompetitions();
  }, [user]);

  return (
    <DashboardLayout title="Teacher Dashboard">
      <div className="space-y-6 animate-fade-in">
        <FrozenBanner />
        <div>
          <p className="text-muted-foreground mb-6">
            View competitions assigned to you and select students for participation
          </p>
        </div>

        <div>
          <h2 className="section-header">Your Assigned Competitions</h2>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : competitions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No competitions assigned to you yet. Contact your coordinator.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {competitions.map((competition) => (
                <Card
                  key={competition.id}
                  className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                  onClick={() => navigate(`/teacher/select-students?competition=${competition.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Trophy className="h-5 w-5 text-primary" />
                      </div>
                      <Badge variant={competition.is_completed ? 'secondary' : 'default'}>
                        {competition.is_completed ? 'Completed' : 'Active'}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-3">{competition.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(competition.competition_date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {competition.venue}
                    </div>
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground mb-2">Your Classes:</p>
                      <div className="flex flex-wrap gap-1">
                        {competition.assigned_classes.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs">
                            Class {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* User Guide */}
        <Card>
          <CardContent className="py-4">
            <a href="/guides/teacher_guide.pdf" download className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <FileText className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-sm">Teacher User Guide</p>
                <p className="text-xs text-muted-foreground">Download PDF guide with step-by-step instructions</p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </a>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
