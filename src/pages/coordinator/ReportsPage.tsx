import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Trophy, Users, Award, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';

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
  event_type: string;
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

interface CompetitionPrize {
  id: string;
  competition_id: string;
  student_id: string;
  prize: string;
  student?: {
    name: string;
    admission_no: string;
    class: number;
    section: string;
  };
  competition?: {
    name: string;
  };
}

const prizeRanking: Record<string, number> = {
  winner: 15,
  runner_up_1: 12,
  runner_up_2: 10,
  first: 9,
  second: 8,
  third: 5,
  consolation: 3,
};

const ReportsPage: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [participations, setParticipations] = useState<ParticipationReport[]>([]);
  const [prizeWinners, setPrizeWinners] = useState<PrizeWinner[]>([]);
  const [competitionPrizes, setCompetitionPrizes] = useState<CompetitionPrize[]>([]);
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
    fetchCompetitionPrizes();
  }, []);

  const fetchParticipationReport = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('student_participations')
      .select(`
        id,
        prize,
        student:students(name, admission_no, class, section),
        event:events(name, event_type)
      `)
      .eq('competition_id', selectedCompetition);

    const report: ParticipationReport[] = (data || []).map((p: any) => ({
      id: p.id,
      student_name: p.student?.name || '',
      admission_no: p.student?.admission_no || '',
      class: p.student?.class || 0,
      section: p.student?.section || '',
      event_name: p.event?.name || '',
      event_type: p.event?.event_type || 'solo',
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
      .not('prize', 'is', null);

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

  const fetchCompetitionPrizes = async () => {
    const { data } = await supabase
      .from('competition_prizes')
      .select('*, student:students(*), competition:competitions(name)');
    setCompetitionPrizes(data || []);
  };

  const getPrizeBadgeVariant = (prize: string | null) => {
    switch (prize) {
      case 'first':
      case 'winner':
        return 'default';
      case 'second':
      case 'runner_up_1':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatPrize = (prize: string) => {
    const labels: Record<string, string> = {
      winner: 'Winner',
      runner_up_1: 'Runner Up 1',
      runner_up_2: 'Runner Up 2',
      first: 'First',
      second: 'Second',
      third: 'Third',
      consolation: 'Consolation',
    };
    return labels[prize] || prize;
  };

  // Export handlers
  const handleExportParticipationPDF = () => {
    const competitionName = competitions.find((c) => c.id === selectedCompetition)?.name || 'Competition';
    const exportData = participations.map((p) => ({
      student_name: p.student_name,
      admission_no: p.admission_no,
      class: p.class,
      section: p.section,
      event_name: p.event_name,
      event_type: p.event_type,
      prize: p.prize ? formatPrize(p.prize) : '—',
    }));
    exportToPDF(
      exportData,
      [
        { header: 'Student Name', key: 'student_name' },
        { header: 'Admission No.', key: 'admission_no' },
        { header: 'Class', key: 'class' },
        { header: 'Section', key: 'section' },
        { header: 'Event', key: 'event_name' },
        { header: 'Type', key: 'event_type' },
        { header: 'Prize', key: 'prize' },
      ],
      `Participation Report - ${competitionName}`,
      `participation-report-${competitionName.toLowerCase().replace(/\s+/g, '-')}`
    );
  };

  const handleExportParticipationExcel = () => {
    const competitionName = competitions.find((c) => c.id === selectedCompetition)?.name || 'Competition';
    const exportData = participations.map((p) => ({
      student_name: p.student_name,
      admission_no: p.admission_no,
      class: p.class,
      section: p.section,
      event_name: p.event_name,
      event_type: p.event_type,
      prize: p.prize ? formatPrize(p.prize) : '—',
    }));
    exportToExcel(
      exportData,
      [
        { header: 'Student Name', key: 'student_name' },
        { header: 'Admission No.', key: 'admission_no' },
        { header: 'Class', key: 'class' },
        { header: 'Section', key: 'section' },
        { header: 'Event', key: 'event_name' },
        { header: 'Type', key: 'event_type' },
        { header: 'Prize', key: 'prize' },
      ],
      'Participation',
      `participation-report-${competitionName.toLowerCase().replace(/\s+/g, '-')}`
    );
  };

  const handleExportWinnersPDF = () => {
    const winnersData = prizeWinners.map((w, idx) => ({
      rank: idx + 1,
      student_name: w.student_name,
      admission_no: w.admission_no,
      class: w.class,
      section: w.section,
      prizes: w.prizes.map((p) => formatPrize(p.prize)).join(', '),
      points: w.total_prizes,
    }));
    exportToPDF(
      winnersData,
      [
        { header: 'Rank', key: 'rank' },
        { header: 'Student Name', key: 'student_name' },
        { header: 'Admission No.', key: 'admission_no' },
        { header: 'Class', key: 'class' },
        { header: 'Section', key: 'section' },
        { header: 'Prizes', key: 'prizes' },
        { header: 'Points', key: 'points' },
      ],
      'Prize Winners Report',
      'prize-winners-report'
    );
  };

  const handleExportWinnersExcel = () => {
    const winnersData = prizeWinners.map((w, idx) => ({
      rank: idx + 1,
      student_name: w.student_name,
      admission_no: w.admission_no,
      class: w.class,
      section: w.section,
      prizes: w.prizes.map((p) => formatPrize(p.prize)).join(', '),
      points: w.total_prizes,
    }));
    exportToExcel(
      winnersData,
      [
        { header: 'Rank', key: 'rank' },
        { header: 'Student Name', key: 'student_name' },
        { header: 'Admission No.', key: 'admission_no' },
        { header: 'Class', key: 'class' },
        { header: 'Section', key: 'section' },
        { header: 'Prizes', key: 'prizes' },
        { header: 'Points', key: 'points' },
      ],
      'Prize Winners',
      'prize-winners-report'
    );
  };

  const handleExportCompetitionPrizesPDF = () => {
    const prizeData = competitionPrizes.map((p) => ({
      competition: p.competition?.name || '',
      prize: formatPrize(p.prize),
      student_name: p.student?.name || '',
      admission_no: p.student?.admission_no || '',
      class: p.student?.class || '',
      section: p.student?.section || '',
    }));
    exportToPDF(
      prizeData,
      [
        { header: 'Competition', key: 'competition' },
        { header: 'Prize', key: 'prize' },
        { header: 'Student Name', key: 'student_name' },
        { header: 'Admission No.', key: 'admission_no' },
        { header: 'Class', key: 'class' },
        { header: 'Section', key: 'section' },
      ],
      'Competition Prizes Report',
      'competition-prizes-report'
    );
  };

  const handleExportCompetitionPrizesExcel = () => {
    const prizeData = competitionPrizes.map((p) => ({
      competition: p.competition?.name || '',
      prize: formatPrize(p.prize),
      student_name: p.student?.name || '',
      admission_no: p.student?.admission_no || '',
      class: p.student?.class || '',
      section: p.student?.section || '',
    }));
    exportToExcel(
      prizeData,
      [
        { header: 'Competition', key: 'competition' },
        { header: 'Prize', key: 'prize' },
        { header: 'Student Name', key: 'student_name' },
        { header: 'Admission No.', key: 'admission_no' },
        { header: 'Class', key: 'class' },
        { header: 'Section', key: 'section' },
      ],
      'Competition Prizes',
      'competition-prizes-report'
    );
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
            <TabsTrigger value="competition-prizes" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Competition Prizes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="participation" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle>Participation Report</CardTitle>
                    <CardDescription>
                      View students participating in each competition
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
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
                    {participations.length > 0 && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportParticipationPDF}>
                          <FileText className="mr-2 h-4 w-4" />
                          PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportParticipationExcel}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          Excel
                        </Button>
                      </div>
                    )}
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
                        <TableHead>Type</TableHead>
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
                            <Badge variant={p.event_type === 'solo' ? 'default' : 'secondary'}>
                              {p.event_type === 'solo' ? 'Solo' : 'Group'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {p.prize ? (
                              <Badge variant={getPrizeBadgeVariant(p.prize)}>
                                {formatPrize(p.prize)}
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      Top Prize Winners
                    </CardTitle>
                    <CardDescription>
                      Students ranked by their prize achievements
                    </CardDescription>
                  </div>
                  {prizeWinners.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleExportWinnersPDF}>
                        <FileText className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportWinnersExcel}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Excel
                      </Button>
                    </div>
                  )}
                </div>
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
                                  {formatPrize(p.prize)}
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

          <TabsContent value="competition-prizes" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      Competition Overall Prizes
                    </CardTitle>
                    <CardDescription>
                      Overall competition winners (Winner, Runner Up 1, Runner Up 2)
                    </CardDescription>
                  </div>
                  {competitionPrizes.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleExportCompetitionPrizesPDF}>
                        <FileText className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportCompetitionPrizesExcel}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Excel
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {competitionPrizes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No competition prizes awarded yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competition</TableHead>
                        <TableHead>Prize</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Admission No.</TableHead>
                        <TableHead>Class</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {competitionPrizes.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.competition?.name}</TableCell>
                          <TableCell>
                            <Badge variant={getPrizeBadgeVariant(p.prize)}>
                              {formatPrize(p.prize)}
                            </Badge>
                          </TableCell>
                          <TableCell>{p.student?.name}</TableCell>
                          <TableCell className="font-mono">{p.student?.admission_no}</TableCell>
                          <TableCell>{p.student?.class}-{p.student?.section}</TableCell>
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
