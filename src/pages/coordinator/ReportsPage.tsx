import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Trophy, Users, Award, FileSpreadsheet, FileText, Calendar, MapPin, FileImage, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { exportToPDF, exportToExcel, type PageSize } from '@/lib/exportUtils';
import { format } from 'date-fns';
import { useDepartment } from '@/hooks/useDepartment';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { scopeToAcademicYear, getAcademicYearRange } from '@/lib/academicYear';

interface Competition { id: string; name: string; competition_date: string; venue: string; overall_status?: string | null; }
interface CompetitionSummaryRow { id: string; name: string; participants: number; winners: number; status: string; }
interface ParticipationReport { id: string; student_name: string; admission_no: string; class: number; section: string; event_name: string; event_type: string; prize: string | null; certificate_url: string | null; }
interface PrizeWinner { student_name: string; admission_no: string; class: number; section: string; total_prizes: number; prizes: { event: string; prize: string; competition: string; certificate_url?: string | null }[]; }

const prizeRanking: Record<string, number> = {
  winner: 15, runner_up_1: 12, runner_up_2: 10, first: 9, second: 8, third: 5, consolation: 3,
};

const overallStatusLabels: Record<string, string> = {
  overall_winner: 'Overall Winner',
  runner_up_1: '1st Runner Up',
  runner_up_2: '2nd Runner Up',
  rotational_shield: 'Rotational Shield',
};

// Reports are capped at 3000 rows per academic year to keep exports performant.
const REPORT_ROW_CAP = 3000;
const PAGE_SIZE_DB = 1000;

/** Fetch up to REPORT_ROW_CAP rows by paginating through Supabase's 1000-row limit. */
async function fetchPaginated<T = any>(
  buildQuery: (from: number, to: number) => any,
): Promise<{ rows: T[]; truncated: boolean }> {
  const all: T[] = [];
  for (let from = 0; from < REPORT_ROW_CAP; from += PAGE_SIZE_DB) {
    const to = Math.min(from + PAGE_SIZE_DB - 1, REPORT_ROW_CAP - 1);
    const { data, error } = await buildQuery(from, to);
    if (error) break;
    const batch = (data || []) as T[];
    all.push(...batch);
    if (batch.length < to - from + 1) return { rows: all, truncated: false };
  }
  return { rows: all, truncated: all.length >= REPORT_ROW_CAP };
}

const ReportsPage: React.FC = () => {
  const { department, departmentLabel } = useDepartment();
  const { role, academicYear } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [participations, setParticipations] = useState<ParticipationReport[]>([]);
  const [prizeWinners, setPrizeWinners] = useState<PrizeWinner[]>([]);
  const [summary, setSummary] = useState<CompetitionSummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [participationSort, setParticipationSort] = useState<'event' | 'class' | 'name'>('event');
  const [viewingCertificate, setViewingCertificate] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    const fetchCompetitions = async () => {
      const { data } = await scopeToAcademicYear(
        supabase.from('competitions').select('id, name, competition_date, venue, overall_status').eq('department', department),
        role,
        academicYear,
      ).order('competition_date', { ascending: false });
      setCompetitions(data || []);
      setIsLoading(false);
    };
    fetchCompetitions();
  }, [department, role, academicYear]);

  useEffect(() => {
    if (selectedCompetition) fetchParticipationReport();
  }, [selectedCompetition]);

  useEffect(() => { fetchPrizeWinners(); }, [department]);

  useEffect(() => { fetchSummary(); }, [competitions]);

  const fetchSummary = async () => {
    if (competitions.length === 0) { setSummary([]); return; }
    const ids = competitions.map((c) => c.id);
    const { rows } = await fetchPaginated<any>((from, to) =>
      supabase
        .from('student_participations')
        .select('competition_id, prize')
        .in('competition_id', ids)
        .range(from, to),
    );
    const counts = new Map<string, { participants: number; winners: number }>();
    rows.forEach((r: any) => {
      const c = counts.get(r.competition_id) || { participants: 0, winners: 0 };
      c.participants += 1;
      if (r.prize) c.winners += 1;
      counts.set(r.competition_id, c);
    });
    setSummary(
      competitions.map((c) => ({
        id: c.id,
        name: c.name,
        participants: counts.get(c.id)?.participants || 0,
        winners: counts.get(c.id)?.winners || 0,
        status: c.overall_status ? overallStatusLabels[c.overall_status] || c.overall_status : '—',
      })),
    );
  };

  const fetchParticipationReport = async () => {
    setIsLoading(true);
    const { rows: data, truncated } = await fetchPaginated<any>((from, to) =>
      supabase
        .from('student_participations')
        .select(`id, prize, certificate_url, student:students(name, admission_no, class, section), event:events(name, event_type)`)
        .eq('competition_id', selectedCompetition)
        .range(from, to),
    );
    if (truncated) {
      toast({ title: 'Showing first 3000 records', description: 'Report capped at 3000 rows per academic year.' });
    }
    const report: ParticipationReport[] = data.map((p: any) => ({
      id: p.id, student_name: p.student?.name || '', admission_no: p.student?.admission_no || '', class: p.student?.class || 0, section: p.student?.section || '', event_name: p.event?.name || '', event_type: p.event?.event_type || 'solo', prize: p.prize, certificate_url: p.certificate_url,
    }));
    setParticipations(report);
    setIsLoading(false);
  };

  const fetchPrizeWinners = async () => {
    const { data: deptCompetitions } = await scopeToAcademicYear(
      supabase.from('competitions').select('id, competition_date').eq('department', department),
      role,
      academicYear,
    );
    const competitionIds = (deptCompetitions || []).map((c) => c.id);
    if (competitionIds.length === 0) { setPrizeWinners([]); return; }

    const { rows: data, truncated } = await fetchPaginated<any>((from, to) =>
      supabase
        .from('student_participations')
        .select(`prize, certificate_url, student:students(id, name, admission_no, class, section), event:events(name), competition:competitions(name)`)
        .not('prize', 'is', null)
        .in('competition_id', competitionIds)
        .range(from, to),
    );
    if (truncated) {
      toast({ title: 'Showing first 3000 records', description: 'Prize winners capped at 3000 rows per academic year.' });
    }

    const winnersMap = new Map<string, PrizeWinner>();
    data.forEach((p: any) => {
      const studentId = p.student?.id;
      if (!studentId) return;
      if (!winnersMap.has(studentId)) {
        winnersMap.set(studentId, { student_name: p.student.name, admission_no: p.student.admission_no, class: p.student.class, section: p.student.section, total_prizes: 0, prizes: [] });
      }
      const winner = winnersMap.get(studentId)!;
      winner.total_prizes += prizeRanking[p.prize] || 0;
      winner.prizes.push({ event: p.event?.name || '', prize: p.prize, competition: p.competition?.name || '', certificate_url: p.certificate_url });
    });
    setPrizeWinners(Array.from(winnersMap.values()).sort((a, b) => b.total_prizes - a.total_prizes));
  };

  const getPrizeBadgeVariant = (prize: string | null) => {
    switch (prize) { case 'first': case 'winner': return 'default'; case 'second': case 'runner_up_1': return 'secondary'; default: return 'outline'; }
  };

  const formatPrize = (prize: string) => {
    const labels: Record<string, string> = { winner: 'Winner', runner_up_1: 'Runner Up 1', runner_up_2: 'Runner Up 2', first: 'First', second: 'Second', third: 'Third', consolation: 'Consolation' };
    return labels[prize] || prize;
  };

  const selectedCompetitionData = competitions.find((c) => c.id === selectedCompetition);

  const sortedParticipations = React.useMemo(() => {
    const rows = [...participations];
    rows.sort((a, b) => {
      if (participationSort === 'class') {
        if (a.class !== b.class) return a.class - b.class;
        if (a.section !== b.section) return a.section.localeCompare(b.section);
        return a.student_name.localeCompare(b.student_name);
      }
      if (participationSort === 'name') return a.student_name.localeCompare(b.student_name);
      const ev = a.event_name.localeCompare(b.event_name);
      if (ev !== 0) return ev;
      return a.student_name.localeCompare(b.student_name);
    });
    return rows;
  }, [participations, participationSort]);

  const handlePrintCertificate = (url: string) => {
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  };

  const handleExportParticipationPDF = () => {
    const comp = selectedCompetitionData;
    const competitionName = comp?.name || 'Competition';
    const competitionDate = comp?.competition_date ? format(new Date(comp.competition_date), 'dd MMM yyyy') : '';
    const venue = comp?.venue || '';
    const exportData = sortedParticipations.map((p) => ({ student_name: p.student_name, admission_no: p.admission_no, class: p.class, section: p.section, event_name: p.event_name, event_type: p.event_type, prize: p.prize ? formatPrize(p.prize) : '—' }));
    exportToPDF(exportData, [
      { header: 'Student Name', key: 'student_name' }, { header: 'Admission No.', key: 'admission_no' }, { header: 'Class', key: 'class' }, { header: 'Section', key: 'section' }, { header: 'Event', key: 'event_name' }, { header: 'Type', key: 'event_type' }, { header: 'Prize', key: 'prize' },
    ], `Participation Report\n${competitionName}\nDate: ${competitionDate} | Venue: ${venue}`, `participation-report-${competitionName.toLowerCase().replace(/\s+/g, '-')}`, pageSize);
  };

  const handleExportParticipationExcel = () => {
    const comp = selectedCompetitionData;
    const competitionName = comp?.name || 'Competition';
    const competitionDate = comp?.competition_date ? format(new Date(comp.competition_date), 'dd MMM yyyy') : '';
    const venue = comp?.venue || '';
    const exportData = sortedParticipations.map((p) => ({ competition_name: competitionName, competition_date: competitionDate, venue: venue, student_name: p.student_name, admission_no: p.admission_no, class: p.class, section: p.section, event_name: p.event_name, event_type: p.event_type, prize: p.prize ? formatPrize(p.prize) : '—' }));
    exportToExcel(exportData, [
      { header: 'Competition', key: 'competition_name' }, { header: 'Date', key: 'competition_date' }, { header: 'Venue', key: 'venue' }, { header: 'Student Name', key: 'student_name' }, { header: 'Admission No.', key: 'admission_no' }, { header: 'Class', key: 'class' }, { header: 'Section', key: 'section' }, { header: 'Event', key: 'event_name' }, { header: 'Type', key: 'event_type' }, { header: 'Prize', key: 'prize' },
    ], 'Participation', `participation-report-${competitionName.toLowerCase().replace(/\s+/g, '-')}`, `Participation Report\n${competitionName}\nDate: ${competitionDate} | Venue: ${venue}`);
  };

  const handleExportWinnersPDF = () => {
    const winnersData = prizeWinners.map((w, idx) => ({ rank: idx + 1, student_name: w.student_name, admission_no: w.admission_no, class: w.class, section: w.section, prizes: w.prizes.map((p) => formatPrize(p.prize)).join(', '), points: w.total_prizes }));
    exportToPDF(winnersData, [
      { header: 'Rank', key: 'rank' }, { header: 'Student Name', key: 'student_name' }, { header: 'Admission No.', key: 'admission_no' }, { header: 'Class', key: 'class' }, { header: 'Section', key: 'section' }, { header: 'Prizes', key: 'prizes' }, { header: 'Points', key: 'points' },
    ], `Prize Winners Report - ${departmentLabel}`, 'prize-winners-report', pageSize);
  };

  const handleExportWinnersExcel = () => {
    const winnersData = prizeWinners.map((w, idx) => ({ rank: idx + 1, student_name: w.student_name, admission_no: w.admission_no, class: w.class, section: w.section, prizes: w.prizes.map((p) => formatPrize(p.prize)).join(', '), points: w.total_prizes }));
    exportToExcel(winnersData, [
      { header: 'Rank', key: 'rank' }, { header: 'Student Name', key: 'student_name' }, { header: 'Admission No.', key: 'admission_no' }, { header: 'Class', key: 'class' }, { header: 'Section', key: 'section' }, { header: 'Prizes', key: 'prizes' }, { header: 'Points', key: 'points' },
    ], 'Prize Winners', 'prize-winners-report', `Prize Winners Report - ${departmentLabel}`);
  };

  const summaryColumns = [
    { header: 'Competition', key: 'name' },
    { header: 'Students Participated', key: 'participants' },
    { header: 'No. of Winners', key: 'winners' },
    { header: 'Status', key: 'status' },
  ];

  const summaryExportData = () => summary.map((s) => ({ name: s.name, participants: s.participants, winners: s.winners, status: s.status }));

  const handleExportSummaryPDF = () => {
    exportToPDF(summaryExportData(), summaryColumns, `Competition Summary - ${departmentLabel}`, 'competition-summary', pageSize);
  };

  const handleExportSummaryExcel = () => {
    exportToExcel(summaryExportData(), summaryColumns, 'Competition Summary', 'competition-summary', `Competition Summary - ${departmentLabel}`);
  };

  return (
    <DashboardLayout title={`${departmentLabel} - Reports`}>
      <div className="space-y-6 animate-fade-in">
        {/* Certificate Viewer Dialog */}
        <Dialog open={!!viewingCertificate} onOpenChange={() => setViewingCertificate(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Certificate - {viewingCertificate?.name}</span>
                <Button size="sm" variant="outline" onClick={() => viewingCertificate && handlePrintCertificate(viewingCertificate.url)}>
                  <Printer className="h-4 w-4 mr-2" />Print
                </Button>
              </DialogTitle>
            </DialogHeader>
            {viewingCertificate && (
              viewingCertificate.url.endsWith('.pdf') ? (
                <iframe src={viewingCertificate.url} className="w-full h-[70vh]" title="Certificate" />
              ) : (
                <img src={viewingCertificate.url} alt="Certificate" className="w-full h-auto max-h-[70vh] object-contain" />
              )
            )}
          </DialogContent>
        </Dialog>

        {/* Page Size Selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Export Page Size:</span>
          <Select value={pageSize} onValueChange={(v) => setPageSize(v as PageSize)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a4">A4</SelectItem>
              <SelectItem value="legal">Legal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="participation">
          <TabsList>
            <TabsTrigger value="participation" className="flex items-center gap-2"><Users className="h-4 w-4" />Participation</TabsTrigger>
            <TabsTrigger value="winners" className="flex items-center gap-2"><Trophy className="h-4 w-4" />Prize Winners</TabsTrigger>
          </TabsList>

          <TabsContent value="participation" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle>Participation Report</CardTitle>
                    <CardDescription>View students participating in each competition</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-64">
                      <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
                        <SelectTrigger><SelectValue placeholder="Select competition" /></SelectTrigger>
                        <SelectContent>
                          {competitions.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-44">
                      <Select value={participationSort} onValueChange={(v) => setParticipationSort(v as 'event' | 'class' | 'name')}>
                        <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="event">Sort by Event</SelectItem>
                          <SelectItem value="class">Sort by Class</SelectItem>
                          <SelectItem value="name">Sort by Student</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {participations.length > 0 && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportParticipationPDF}><FileText className="mr-2 h-4 w-4" />PDF</Button>
                        <Button variant="outline" size="sm" onClick={handleExportParticipationExcel}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!selectedCompetition ? (
                  <div className="text-center py-8 text-muted-foreground">Please select a competition to view participation report</div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : participations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No participants found</div>
                ) : (
                  <div className="space-y-4">
                    {selectedCompetitionData && (
                      <div className="bg-muted/50 rounded-lg p-4 border">
                        <h3 className="font-semibold text-lg">{selectedCompetitionData.name}</h3>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /><span>{format(new Date(selectedCompetitionData.competition_date), 'dd MMMM yyyy')}</span></div>
                          <div className="flex items-center gap-1"><MapPin className="h-4 w-4" /><span>{selectedCompetitionData.venue}</span></div>
                        </div>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead><TableHead>Admission No.</TableHead><TableHead>Class</TableHead><TableHead>Event</TableHead><TableHead>Type</TableHead><TableHead>Prize</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedParticipations.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.student_name}</TableCell>
                            <TableCell className="font-mono">{p.admission_no}</TableCell>
                            <TableCell>{p.class}-{p.section}</TableCell>
                            <TableCell>{p.event_name}</TableCell>
                            <TableCell><Badge variant={p.event_type === 'solo' ? 'default' : 'secondary'}>{p.event_type === 'solo' ? 'Solo' : 'Group'}</Badge></TableCell>
                            <TableCell>{p.prize ? (<Badge variant={getPrizeBadgeVariant(p.prize)}>{formatPrize(p.prize)}</Badge>) : (<span className="text-muted-foreground">—</span>)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="winners" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" />Top Prize Winners</CardTitle>
                    <CardDescription>Students ranked by their prize achievements in {departmentLabel.toLowerCase()}. Click a student name to view their certificate.</CardDescription>
                  </div>
                  {prizeWinners.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleExportWinnersPDF}><FileText className="mr-2 h-4 w-4" />PDF</Button>
                      <Button variant="outline" size="sm" onClick={handleExportWinnersExcel}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {prizeWinners.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No prize winners yet</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead className="w-12">Rank</TableHead><TableHead>Student</TableHead><TableHead>Admission No.</TableHead><TableHead>Class</TableHead><TableHead>Prizes</TableHead><TableHead>Points</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {prizeWinners.map((winner, idx) => {
                        const certPrize = winner.prizes.find((p) => p.certificate_url);
                        return (
                          <TableRow key={winner.admission_no}>
                            <TableCell className="font-bold">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</TableCell>
                            <TableCell>
                              {certPrize?.certificate_url ? (
                                <button
                                  className="font-medium text-primary underline underline-offset-2 hover:text-primary/80 flex items-center gap-1"
                                  onClick={() => setViewingCertificate({ url: certPrize.certificate_url!, name: winner.student_name })}
                                >
                                  <FileImage className="h-3 w-3" />
                                  {winner.student_name}
                                </button>
                              ) : (
                                <span className="font-medium">{winner.student_name}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono">{winner.admission_no}</TableCell>
                            <TableCell>{winner.class}-{winner.section}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {winner.prizes.map((p, i) => (<Badge key={i} variant={getPrizeBadgeVariant(p.prize)} className="text-xs">{formatPrize(p.prize)}</Badge>))}
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{winner.total_prizes}</TableCell>
                          </TableRow>
                        );
                      })}
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
