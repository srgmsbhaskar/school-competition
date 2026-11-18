import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Loader2, Printer, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDepartment } from '@/hooks/useDepartment';
import { forceAcademicYear } from '@/lib/academicYear';
import { downloadWinnerCertificate, downloadWinnerCertificates, isCertificatePrizeWinner, printWinnerCertificates, type WinnerCertificate } from '@/lib/certificatePdf';
import { toast } from 'sonner';

interface Competition { id: string; name: string; competition_date: string; }
interface ParticipationRow {
  id: string;
  prize: string | null;
  student: { name: string; class: number; section: string } | null;
  event: { name: string } | null;
}

const prizeLabel: Record<string, string> = {
  first: 'FIRST',
  second: 'SECOND',
  third: 'THIRD',
  consolation: 'CONSOLATION',
  champion: 'OVERALL CHAMPION',
  runner_up_1: '1ST RUNNER UP',
  runner_up_2: '2ND RUNNER UP',
  participation: 'PARTICIPATION',
};

const CertificatesPage: React.FC = () => {
  const { department, departmentLabel } = useDepartment();
  const { academicYear } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [rows, setRows] = useState<ParticipationRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  useEffect(() => {
    const fetchCompetitions = async () => {
      const { data } = await forceAcademicYear(
        supabase.from('competitions').select('id, name, competition_date').eq('department', department),
        academicYear,
      ).order('competition_date', { ascending: false });
      setCompetitions(data || []);
    };
    fetchCompetitions();
  }, [department, academicYear]);

  useEffect(() => {
    if (!selectedCompetition) {
      setRows([]);
      setSelected({});
      setSelectedClass('all');
      return;
    }
    const fetchRows = async () => {
      setIsLoading(true);
      setSelectedClass('all');
      try {
        const allRows: ParticipationRow[] = [];
        const pageSize = 1000;
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await supabase
            .from('student_participations')
            .select('id, prize, student:students(name, class, section), event:events(name)')
            .eq('competition_id', selectedCompetition)
            .not('prize', 'is', null)
            .order('id')
            .range(from, from + pageSize - 1);
          if (error) throw error;
          const pageRows = (data || []) as ParticipationRow[];
          allRows.push(...pageRows);
          if (pageRows.length < pageSize) break;
        }
        const prizeWinners = allRows.filter((row) => isCertificatePrizeWinner(row.prize));
        setRows(prizeWinners);
        const initial: Record<string, boolean> = {};
        prizeWinners.forEach((r) => { initial[r.id] = true; });
        setSelected(initial);
      } catch {
        setRows([]);
        setSelected({});
        toast.error('Unable to load prize winners. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchRows();
  }, [selectedCompetition]);

  const classOptions = useMemo(() => [...new Set(rows
    .map((row) => row.student?.class)
    .filter((className): className is number => typeof className === 'number'))]
    .sort((a, b) => a - b), [rows]);
  const filteredRows = useMemo(() => selectedClass === 'all'
    ? rows
    : rows.filter((row) => String(row.student?.class ?? '') === selectedClass), [rows, selectedClass]);
  const selectedRows = useMemo(() => filteredRows.filter((r) => selected[r.id]), [filteredRows, selected]);
  const competition = competitions.find((c) => c.id === selectedCompetition);
  const yearLabel = academicYear;

  const toggleAll = (checked: boolean) => {
    const next = { ...selected };
    filteredRows.forEach((r) => { next[r.id] = checked; });
    setSelected(next);
  };

  const toCertificate = (row: ParticipationRow): WinnerCertificate => ({
    studentName: row.student?.name || 'Student',
    className: `${row.student?.class ?? ''}-${row.student?.section ?? ''}`,
    eventName: row.event?.name || 'Competition Event',
    prizeName: prizeLabel[row.prize || ''] || row.prize || 'Prize Winner',
    competitionName: competition?.name || 'Intraschool Competition',
  });

  const handleDownload = async (row: ParticipationRow) => {
    setDownloadingId(row.id);
    try {
      await downloadWinnerCertificate(toCertificate(row));
    } catch {
      toast.error('Unable to download this certificate. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleBulkDownload = async () => {
    if (filteredRows.length === 0) return;
    setIsBulkDownloading(true);
    try {
      const count = await downloadWinnerCertificates(filteredRows.map(toCertificate));
      toast.success(`${count} individual certificate PDFs downloaded.`);
    } catch {
      toast.error('Unable to download certificates. Please try again.');
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const handlePrint = () => {
    const opened = printWinnerCertificates(selectedRows.map(toCertificate));
    if (!opened) toast.error('Allow pop-ups to print certificates.');
  };

  const handlePrintOne = (row: ParticipationRow) => {
    if (!printWinnerCertificates([toCertificate(row)])) toast.error('Allow pop-ups to print certificates.');
  };

  return (
    <DashboardLayout title={`${departmentLabel} - Certificates`}>
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" />Winner Certificates</CardTitle>
                <CardDescription>Generate printable certificates for prize winners</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-44">
                  <Select value={selectedClass} onValueChange={setSelectedClass} disabled={!selectedCompetition || rows.length === 0}>
                    <SelectTrigger aria-label="Filter by class"><SelectValue placeholder="All classes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All classes</SelectItem>
                      {classOptions.map((className) => (
                        <SelectItem key={className} value={String(className)}>Class {className}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-64">
                  <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
                    <SelectTrigger aria-label="Select competition"><SelectValue placeholder="Select competition" /></SelectTrigger>
                    <SelectContent>
                      {competitions.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handlePrint} disabled={selectedRows.length === 0}>
                  <Printer className="mr-2 h-4 w-4" />Print ({selectedRows.length})
                </Button>
                <Button onClick={() => void handleBulkDownload()} disabled={filteredRows.length === 0 || isBulkDownloading}>
                  {isBulkDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Download all ({filteredRows.length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedCompetition ? (
              <div className="text-center py-8 text-muted-foreground">Select a competition to view winners.</div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No prize winners recorded yet for this competition.</div>
            ) : filteredRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No prize winners match this class.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredRows.length > 0 && selectedRows.length === filteredRows.length}
                        onCheckedChange={(c) => toggleAll(Boolean(c))}
                      />
                    </TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Prize</TableHead>
                    <TableHead className="w-36 text-right">Certificate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          checked={!!selected[r.id]}
                          onCheckedChange={(c) => setSelected((p) => ({ ...p, [r.id]: Boolean(c) }))}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.student?.name}</TableCell>
                      <TableCell>{r.student?.class}-{r.student?.section}</TableCell>
                      <TableCell>{r.event?.name}</TableCell>
                      <TableCell>{prizeLabel[r.prize || ''] || r.prize}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDownload(r)}
                            disabled={downloadingId === r.id}
                            aria-label={`Download certificate for ${r.student?.name || 'student'}`}
                          >
                            {downloadingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                            PDF
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handlePrintOne(r)} aria-label={`Print certificate for ${r.student?.name || 'student'}`} title="Print certificate">
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
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

export default CertificatesPage;