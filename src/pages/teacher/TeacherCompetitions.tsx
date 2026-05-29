import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Calendar, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { scopeToAcademicYear } from '@/lib/academicYear';

interface Competition {
  id: string;
  name: string;
  competition_date: string;
  venue: string;
  is_completed: boolean;
  assigned_classes: number[];
  events_count: number;
}

const TeacherCompetitions: React.FC = () => {
  const { user, role, academicYear } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCompetitions = async () => {
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

      const competitionIds = [...new Set(assignments.map((a) => a.competition_id))];

      const { data: competitionsData } = await scopeToAcademicYear(
        supabase
          .from('competitions')
          .select('*')
          .in('id', competitionIds),
        role,
        academicYear,
      ).order('competition_date', { ascending: false });

      const { data: eventsData } = await supabase
        .from('events')
        .select('id, competition_id')
        .in('competition_id', competitionIds);

      const result: Competition[] = (competitionsData || []).map((c) => ({
        ...c,
        assigned_classes: assignments
          .filter((a) => a.competition_id === c.id)
          .map((a) => a.class)
          .sort((a, b) => a - b),
        events_count: (eventsData || []).filter((e) => e.competition_id === c.id).length,
      }));

      setCompetitions(result);
      setIsLoading(false);
    };

    fetchCompetitions();
  }, [user]);

  return (
    <DashboardLayout title="My Competitions">
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle>Assigned Competitions</CardTitle>
            <CardDescription>
              Competitions where you are assigned as the in-charge teacher
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : competitions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No competitions assigned to you yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competition</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Your Classes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitions.map((competition) => (
                    <TableRow key={competition.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-primary" />
                          {competition.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(competition.competition_date).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {competition.venue}
                        </div>
                      </TableCell>
                      <TableCell>{competition.events_count}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {competition.assigned_classes.map((c) => (
                            <Badge key={c} variant="outline" className="text-xs">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={competition.is_completed ? 'secondary' : 'default'}>
                          {competition.is_completed ? 'Completed' : 'Active'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TeacherCompetitions;
