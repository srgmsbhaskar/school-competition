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
import { HOUSES, resolveHouse } from '@/lib/houses';

interface Competition { id: string; name: string; competition_date: string; venue: string; overall_status?: string | null; }
interface CompetitionSummaryRow { id: string; name: string; participants: number; winners: number; status: string; }
interface ParticipationReport { id: string; student_name: string; admission_no: string; class: number; section: string; event_name: string; event_type: string; prize: string | null; certificate_url: string | null; }
interface PrizeWinner { student_name: string; admission_no: string; class: number; section: string; total_prizes: number; prizes: { event: string; prize: string; competition: string; certificate_url?: string | null }[]; }
interface HousePointRow { id: string; house: string; student_name: string; admission_no: string; class: number; section: string; event_id: string; event_name: string; competition: string; prize: string | null; points: number; max_points: number; group_number: number | null; event_type: string; }

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
  const [participationEventFilter, setParticipationEventFilter] = useState<string>('all');
  const [viewingCertificate, setViewingCertificate] = useState<{ url: string; name: string } | null>(null);
  const [houseRows, setHouseRows] = useState<HousePointRow[]>([]);
  const [houseFilter, setHouseFilter] = useState<string>('all');
  const [houseEventFilter, setHouseEventFilter] = useState<string>('all');
  const [houseClassFilter, setHouseClassFilter] = useState<string>('all');
  const [houseDrillDown, setHouseDrillDown] = useState<string | null>(null);
  const isSports = department === 'sports';

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

  useEffect(() => { if (isSports) fetchHousePoints(); }, [department, role, academicYear]);

  const fetchHousePoints = async () => {
    const { data: deptCompetitions } = await scopeToAcademicYear(
      supabase.from('competitions').select('id, name').eq('department', department),
      role,
      academicYear,
    );
    const comps = deptCompetitions || [];
    if (comps.length === 0) { setHouseRows([]); return; }
    const compNames = new Map(comps.map((c: any) => [c.id, c.name]));

    const { rows } = await fetchPaginated<any>((from, to) =>
      supabase
        .from('student_participations')
        .select('id, prize, house, group_number, competition_id, student:students(name, admission_no, class, section), event:events(id, name, event_type)')
        .in('competition_id', Array.from(compNames.keys()))
        .range(from, to),
    );

    const eventIds = Array.from(new Set(rows.map((r: any) => r.event?.id).filter(Boolean)));
    const pointsMap = new Map<string, number>();
    if (eventIds.length > 0) {
      const { data: pointsData } = await supabase
        .from('event_prize_points')
        .select('event_id, prize, points')
        .in('event_id', eventIds);
      (pointsData || []).forEach((p: any) => pointsMap.set(`${p.event_id}|${p.prize}`, p.points));
    }

    // Group events score once for the whole group: the points land on the first
    // member of each (event, group, prize) and the rest carry 0 to avoid double counting.
    const countedGroups = new Set<string>();
    setHouseRows(
      rows.map((r: any) => {
        const basePoints = r.prize ? pointsMap.get(`${r.event?.id}|${r.prize}`) || 0 : 0;
        const isGroup = r.event?.event_type === 'group';
        let points = basePoints;
        if (isGroup && basePoints > 0) {
          const key = `${r.event?.id}|${r.group_number ?? 1}|${r.prize}`;
          if (countedGroups.has(key)) points = 0;
          else countedGroups.add(key);
        }
        return {
          id: r.id,
          house: resolveHouse(r.house, r.student?.class ?? 0, r.student?.section) || '—',
          student_name: r.student?.name || '',
          admission_no: r.student?.admission_no || '',
          class: r.student?.class || 0,
          section: r.student?.section || '',
          event_id: r.event?.id || '',
          event_name: r.event?.name || '',
          competition: compNames.get(r.competition_id) || '',
          prize: r.prize,
          points,
          max_points: pointsMap.get(`${r.event?.id}|first`) || 0,
          group_number: r.group_number ?? null,
          event_type: r.event?.event_type || 'solo',
        };
      }),
    );
  };

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
    setParticipationEventFilter('all');
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
    const labels: Record<string, string> = { winner: 'Winner', runner_up_1: 'Runner Up 1', runner_up_2: 'Runner Up 2', first: 'First', second: 'Second', third: 'Third', fourth: 'Fourth', fifth: 'Fifth', consolation: 'Consolation' };
    return labels[prize] || prize;
  };

  const filteredHouseRows = React.useMemo(
    () =>
      houseRows
        .filter((r) => houseFilter === 'all' || r.house === houseFilter)
        .filter((r) => houseEventFilter === 'all' || r.event_name === houseEventFilter)
        .filter((r) => houseClassFilter === 'all' || String(r.class) === houseClassFilter)
        .sort((a, b) => a.house.localeCompare(b.house) || a.event_name.localeCompare(b.event_name) || b.points - a.points),
    [houseRows, houseFilter, houseEventFilter, houseClassFilter],
  );

  const houseTotals = React.useMemo(() => {
    const totals = new Map<string, { house: string; points: number; maxPoints: number; events: number; participants: number; winners: number }>();
    const countedEvents = new Set<string>();
    HOUSES.forEach((h) => totals.set(h, { house: h, points: 0, maxPoints: 0, events: 0, participants: 0, winners: 0 }));
    filteredHouseRows.forEach((r) => {
      if (!totals.has(r.house)) totals.set(r.house, { house: r.house, points: 0, maxPoints: 0, events: 0, participants: 0, winners: 0 });
      const t = totals.get(r.house)!;
      t.points += r.points;
      t.participants += 1;
      if (r.prize) t.winners += 1;
      // Maximum possible = first-prize points for each distinct event the house entered
      const key = `${r.house}|${r.event_id}`;
      if (r.event_id && !countedEvents.has(key)) {
        countedEvents.add(key);
        t.maxPoints += r.max_points;
        t.events += 1;
      }
    });
    return Array.from(totals.values()).sort((a, b) => b.points - a.points);
  }, [filteredHouseRows]);

  const houseEventOptions = React.useMemo(
    () => Array.from(new Set(houseRows.map((r) => r.event_name).filter(Boolean))).sort(),
    [houseRows],
  );

  const drillDownRows = React.useMemo(
    () => filteredHouseRows.filter((r) => r.house === houseDrillDown),
    [filteredHouseRows, houseDrillDown],
  );

  const houseClassOptions = React.useMemo(
    () => Array.from(new Set(houseRows.map((r) => r.class).filter(Boolean))).sort((a, b) => a - b),
    [houseRows],
  );

  const houseDetailColumns = [
    { header: 'House', key: 'house' },
    { header: 'Student', key: 'student_name' },
    { header: 'Admission No.', key: 'admission_no' },
    { header: 'Class', key: 'class_section' },
    { header: 'Event', key: 'event_name' },
    { header: 'Prize', key: 'prize' },
    { header: 'Points', key: 'points' },
  ];

  const houseExportData = () => [
    ...houseTotals.map((t) => ({ house: t.house, student_name: 'TOTAL', admission_no: '', class_section: '', event_name: `${t.events} event(s)`, prize: `${t.winners} winner(s)`, points: `${t.points} / ${t.maxPoints}` })),
    ...filteredHouseRows.map((r) => ({ house: r.house, student_name: r.student_name, admission_no: r.admission_no, class_section: `${r.class}-${r.section}`, event_name: r.event_name, prize: r.prize ? formatPrize(r.prize) : '—', points: r.points })),
  ];

  const houseReportTitle = () =>
    `House Points Report - ${departmentLabel}\nHouse: ${houseFilter === 'all' ? 'All' : houseFilter} | Event: ${houseEventFilter === 'all' ? 'All' : houseEventFilter} | Class: ${houseClassFilter === 'all' ? 'All' : houseClassFilter}`;

  const handleExportHousePDF = () => exportToPDF(houseExportData(), houseDetailColumns, houseReportTitle(), 'house-points-report', pageSize);
  const handleExportHouseExcel = () => exportToExcel(houseExportData(), houseDetailColumns, 'House Points', 'house-points-report', houseReportTitle());

  const selectedCompetitionData = competitions.find((c) => c.id === selectedCompetition);

  const sortedParticipations = React.useMemo(() => {
    const rows = participations.filter(
      (p) => participationEventFilter === 'all' || p.event_name === participationEventFilter,
    );
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
  }, [participations, participationSort, participationEventFilter]);

  const participationEventOptions = React.useMemo(
    () => Array.from(new Set(participations.map((p) => p.event_name).filter(Boolean))).sort(),
    [participations],
  );

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
            <TabsTrigger value="summary" className="flex items-center gap-2"><Award className="h-4 w-4" />Competition Summary</TabsTrigger>
            {isSports && (
              <TabsTrigger value="houses" className="flex items-center gap-2"><Trophy className="h-4 w-4" />House Points</TabsTrigger>
            )}
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
                      <Select value={participationEventFilter} onValueChange={setParticipationEventFilter}>
                        <SelectTrigger><SelectValue placeholder="All events" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All events</SelectItem>
                          {participationEventOptions.map((e) => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
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

          <TabsContent value="summary" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" />Competition Summary</CardTitle>
                    <CardDescription>Participation, winners and overall status for each {departmentLabel.toLowerCase()} competition</CardDescription>
                  </div>
                  {summary.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleExportSummaryPDF}><FileText className="mr-2 h-4 w-4" />PDF</Button>
                      <Button variant="outline" size="sm" onClick={handleExportSummaryExcel}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {summary.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No competitions found</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competition</TableHead>
                        <TableHead>Students Participated</TableHead>
                        <TableHead>No. of Winners</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>{s.participants}</TableCell>
                          <TableCell>{s.winners}</TableCell>
                          <TableCell>
                            {s.status === '—' ? <span className="text-muted-foreground">—</span> : <Badge variant="outline">{s.status}</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isSports && (
            <TabsContent value="houses" className="mt-6">
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />House Points</CardTitle>
                      <CardDescription>Total points scored by each house. Points come from the prize points set for each event.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-44">
                        <Select value={houseFilter} onValueChange={setHouseFilter}>
                          <SelectTrigger><SelectValue placeholder="All houses" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All houses</SelectItem>
                            {HOUSES.map((h) => (<SelectItem key={h} value={h}>{h}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-44">
                        <Select value={houseEventFilter} onValueChange={setHouseEventFilter}>
                          <SelectTrigger><SelectValue placeholder="All events" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All events</SelectItem>
                            {houseEventOptions.map((e) => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-36">
                        <Select value={houseClassFilter} onValueChange={setHouseClassFilter}>
                          <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All classes</SelectItem>
                            {houseClassOptions.map((c) => (<SelectItem key={c} value={String(c)}>Class {c}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportHousePDF}><FileText className="mr-2 h-4 w-4" />PDF</Button>
                        <Button variant="outline" size="sm" onClick={handleExportHouseExcel}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead className="w-12">Rank</TableHead><TableHead>House</TableHead><TableHead>Participations</TableHead><TableHead>Winners</TableHead><TableHead>Total Points</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {houseTotals.map((t, idx) => (
                        <TableRow
                          key={t.house}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setHouseDrillDown(t.house)}
                        >
                          <TableCell className="font-bold">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</TableCell>
                          <TableCell className="font-medium">{t.house}</TableCell>
                          <TableCell>{t.participants}</TableCell>
                          <TableCell>{t.winners}</TableCell>
                          <TableCell className="font-semibold">{t.points}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="mt-3 text-xs text-muted-foreground">Click a house to see the participations behind its points.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Detailed Breakdown</CardTitle>
                  <CardDescription>Every participation counted towards the house totals above</CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredHouseRows.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No participation records found</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>House</TableHead><TableHead>Student</TableHead><TableHead>Admission No.</TableHead><TableHead>Class</TableHead><TableHead>Event</TableHead><TableHead>Group</TableHead><TableHead>Prize</TableHead><TableHead>Points</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHouseRows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.house}</TableCell>
                            <TableCell className="font-medium">{r.student_name}</TableCell>
                            <TableCell className="font-mono">{r.admission_no}</TableCell>
                            <TableCell>{r.class}-{r.section}</TableCell>
                            <TableCell>{r.event_name}</TableCell>
                            <TableCell>{r.event_type === 'group' ? `Group ${r.group_number ?? 1}` : '—'}</TableCell>
                            <TableCell>{r.prize ? (<Badge variant={getPrizeBadgeVariant(r.prize)}>{formatPrize(r.prize)}</Badge>) : (<span className="text-muted-foreground">—</span>)}</TableCell>
                            <TableCell className="font-semibold">{r.points}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Dialog open={!!houseDrillDown} onOpenChange={(open) => !open && setHouseDrillDown(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {houseDrillDown} — participations
                      {houseEventFilter !== 'all' ? ` · ${houseEventFilter}` : ''}
                      {houseClassFilter !== 'all' ? ` · Class ${houseClassFilter}` : ''}
                    </DialogTitle>
                  </DialogHeader>
                  {drillDownRows.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No participation records found</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Event</TableHead><TableHead>Group</TableHead><TableHead>Prize</TableHead><TableHead>Points</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {drillDownRows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.student_name}</TableCell>
                            <TableCell>{r.class}-{r.section}</TableCell>
                            <TableCell>{r.event_name}</TableCell>
                            <TableCell>{r.event_type === 'group' ? `Group ${r.group_number ?? 1}` : '—'}</TableCell>
                            <TableCell>{r.prize ? (<Badge variant={getPrizeBadgeVariant(r.prize)}>{formatPrize(r.prize)}</Badge>) : (<span className="text-muted-foreground">—</span>)}</TableCell>
                            <TableCell className="font-semibold">{r.points}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </DialogContent>
              </Dialog>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
