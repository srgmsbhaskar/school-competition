import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Trophy, Users, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Competition {
  id: string;
  name: string;
}

interface ParticipationReport {
  id: string;
  student_name: string;
  admission_no: string;
  class: number;
  section: string;
  event_name: string;
  prize: string | null;
}

interface PrizeWinner {
  student_name: string;
  admission_no: string;
  class: number;
  section: string;
  total_prizes: number;
  prizes: { event: string; prize: string; competition: string }[];
}

const prizeRanking: Record<string, number> = {
  champion: 10,
  first: 9,
  second: 8,
  runner_up_1: 7,
  runner_up_2: 6,
  third: 5,
  consolation: 3,
  participation: 1,
  other: 2,
};

const ReportsPage: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [participations, setParticipations] = useState<ParticipationReport[]>([]);
  const [prizeWinners, setPrizeWinners] = useState<PrizeWinner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCompetitions = async () => {
      const { data } = await supabase
        .from('competitions')
        .select('id, name')
        .order('competition_date', { ascending: false });
      setCompetitions(data || []);
      setIsLoading(false);
    };
    fetchCompetitions();
  }, []);

  useEffect(() => {
    if (selectedCompetition) {
      fetchParticipationReport();
    }
  }, [selectedCompetition]);

  useEffect(() => {
    fetchPrizeWinners();
  }, []);

  const fetchParticipationReport = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('student_participations')
      .select(`
        id,
        prize,
        student:students(name, admission_no, class, section),
        event:events(name)
      `)
      .eq('competition_id', selectedCompetition);

    const report: ParticipationReport[] = (data || []).map((p: any) => ({
      id: p.id,
      student_name: p.student?.name || '',
      admission_no: p.student?.admission_no || '',
      class: p.student?.class || 0,
      section: p.student?.section || '',
      event_name: p.event?.name || '',
      prize: p.prize,
    }));

    setParticipations(report);
    setIsLoading(false);
  };

  const fetchPrizeWinners = async () => {
    const { data } = await supabase
      .from('student_participations')
      .select(`
        prize,
        student:students(id, name, admission_no, class, section),
        event:events(name),
        competition:competitions(name)
      `)
      .not('prize', 'is', null)
      .neq('prize', 'participation');

    const winnersMap = new Map<string, PrizeWinner>();

    (data || []).forEach((p: any) => {
      const studentId = p.student?.id;
      if (!studentId) return;

      if (!winnersMap.has(studentId)) {
        winnersMap.set(studentId, {
          student_name: p.student.name,
          admission_no: p.student.admission_no,
          class: p.student.class,
          section: p.student.section,
          total_prizes: 0,
          prizes: [],
        });
      }

      const winner = winnersMap.get(studentId)!;
      winner.total_prizes += prizeRanking[p.prize] || 0;
      winner.prizes.push({
        event: p.event?.name || '',
        prize: p.prize,
        competition: p.competition?.name || '',
      });
    });

    const sortedWinners = Array.from(winnersMap.values()).sort(
      (a, b) => b.total_prizes - a.total_prizes
    );

    setPrizeWinners(sortedWinners);
  };

  const getPrizeBadgeVariant = (prize: string | null) => {
    switch (prize) {
      case 'first':
      case 'champion':
        return 'default';
      case 'second':
      case 'runner_up_1':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <DashboardLayout title="Reports">
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="participation">
          <TabsList>
            <TabsTrigger value="participation" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participation
            </TabsTrigger>
            <TabsTrigger value="winners" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Prize Winners
            </TabsTrigger>
          </TabsList>

          <TabsContent value="participation" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Participation Report</CardTitle>
                    <CardDescription>
                      View students participating in each competition
                    </CardDescription>
                  </div>
                  <div className="w-64">
                    <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select competition" />
                      </SelectTrigger>
                      <SelectContent>
                        {competitions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!selectedCompetition ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Please select a competition to view participation report
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : participations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No participants found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Admission No.</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Prize</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participations.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.student_name}</TableCell>
                          <TableCell className="font-mono">{p.admission_no}</TableCell>
                          <TableCell>{p.class}-{p.section}</TableCell>
                          <TableCell>{p.event_name}</TableCell>
                          <TableCell>
                            {p.prize ? (
                              <Badge variant={getPrizeBadgeVariant(p.prize)}>
                                {p.prize.replace('_', ' ')}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="winners" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Top Prize Winners
                </CardTitle>
                <CardDescription>
                  Students ranked by their prize achievements (excluding participation)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {prizeWinners.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No prize winners yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Rank</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Admission No.</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Prizes</TableHead>
                        <TableHead>Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prizeWinners.map((winner, idx) => (
                        <TableRow key={winner.admission_no}>
                          <TableCell className="font-bold">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </TableCell>
                          <TableCell className="font-medium">{winner.student_name}</TableCell>
                          <TableCell className="font-mono">{winner.admission_no}</TableCell>
                          <TableCell>{winner.class}-{winner.section}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {winner.prizes.map((p, i) => (
                                <Badge key={i} variant={getPrizeBadgeVariant(p.prize)} className="text-xs">
                                  {p.prize.replace('_', ' ')}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">{winner.total_prizes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
