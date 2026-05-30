import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Printer, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDepartment } from '@/hooks/useDepartment';
import { forceAcademicYear } from '@/lib/academicYear';
import schoolEmblem from '@/assets/school-emblem.jpg';

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
  const [rows, setRows] = useState<ParticipationRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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
      return;
    }
    const fetchRows = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('student_participations')
        .select('id, prize, student:students(name, class, section), event:events(name)')
        .eq('competition_id', selectedCompetition)
        .not('prize', 'is', null);
      setRows((data as any) || []);
      const initial: Record<string, boolean> = {};
      (data || []).forEach((r: any) => { initial[r.id] = true; });
      setSelected(initial);
      setIsLoading(false);
    };
    fetchRows();
  }, [selectedCompetition]);

  const selectedRows = useMemo(() => rows.filter((r) => selected[r.id]), [rows, selected]);
  const competition = competitions.find((c) => c.id === selectedCompetition);
  const yearLabel = academicYear;

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    rows.forEach((r) => { next[r.id] = checked; });
    setSelected(next);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Certificates</title>
      <style>
        @page { size: A4 landscape; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #1e3a8a; }
        .cert { width: 297mm; height: 210mm; padding: 14mm; page-break-after: always; position: relative; }
        .cert:last-child { page-break-after: auto; }
        .frame { border: 3px solid #4a90c8; border-radius: 6px; padding: 6px; height: 100%; }
        .inner { border: 1px solid #4a90c8; border-radius: 4px; height: 100%; padding: 18mm 22mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .school { font-family: 'Arial Black', Arial, sans-serif; font-size: 38px; letter-spacing: 4px; color: #1e3a8a; }
        .sub { font-family: Arial, sans-serif; font-size: 18px; letter-spacing: 6px; margin-top: 4px; color: #1e3a8a; }
        .emblem { width: 90px; height: 90px; margin: 8px 0; object-fit: contain; }
        .title { font-family: 'Brush Script MT', cursive; font-size: 60px; color: #1e3a8a; margin-top: 4px; }
        .year { font-size: 18px; margin-top: 2px; }
        .body { font-size: 20px; line-height: 2; margin-top: 28px; max-width: 220mm; }
        .body .blank { display: inline-block; min-width: 220px; border-bottom: 1px solid #1e3a8a; padding: 0 8px; font-weight: 700; }
        .signs { margin-top: auto; display: flex; justify-content: space-between; width: 100%; padding: 0 4mm; font-size: 13px; letter-spacing: 2px; font-weight: 700; }
      </style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
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
                <div className="w-64">
                  <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
                    <SelectTrigger><SelectValue placeholder="Select competition" /></SelectTrigger>
                    <SelectContent>
                      {competitions.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handlePrint} disabled={selectedRows.length === 0}>
                  <Printer className="mr-2 h-4 w-4" />Print ({selectedRows.length})
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
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={rows.length > 0 && selectedRows.length === rows.length}
                        onCheckedChange={(c) => toggleAll(Boolean(c))}
                      />
                    </TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Prize</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Hidden printable area */}
        <div className="hidden">
          <div ref={printRef}>
            {selectedRows.map((r) => (
              <div key={r.id} className="cert">
                <div className="frame">
                  <div className="inner">
                    <div className="school">SRI VAGEESHA VIDHYASHRAM</div>
                    <div className="sub">SENIOR SECONDARY SCHOOL</div>
                    <img src={schoolEmblem} alt="emblem" className="emblem" />
                    <div className="title">Co-Curricular Activity</div>
                    <div className="year">{yearLabel}</div>
                    <div className="body">
                      This is to certify that Master/Miss <span className="blank">{r.student?.name}</span>{' '}
                      of class <span className="blank">{r.student?.class}-{r.student?.section}</span>{' '}
                      has won the <span className="blank">{prizeLabel[r.prize || ''] || r.prize}</span>{' '}
                      prize in the <span className="blank">{r.event?.name}</span> event
                      {competition ? <> of <span className="blank">{competition.name}</span></> : null}.
                    </div>
                    <div className="signs">
                      <span>PHYSICAL DIRECTOR</span>
                      <span>CEO</span>
                      <span>PRINCIPAL</span>
                      <span>CORRESPONDENT</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CertificatesPage;