import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Save, Trophy, Award, Upload, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDepartment } from '@/hooks/useDepartment';
import { forceAcademicYear } from '@/lib/academicYear';

interface Competition { id: string; name: string; is_completed: boolean; }
interface Event { id: string; name: string; competition_id: string; event_type: 'solo' | 'group'; }
interface Participation { id: string; student_id: string; event_id: string; prize: string | null; certificate_url: string | null; student: { id: string; name: string; admission_no: string; class: number; section: string; }; }
interface Student { id: string; name: string; admission_no: string; class: number; section: string; }
interface CompetitionPrize { id: string; competition_id: string; student_id: string; prize: string; student?: Student; }
interface OverallPrizeRow extends CompetitionPrize { competition?: { id: string; name: string; competition_date: string; venue: string }; }

const individualPrizeOptions = [
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
  { value: 'third', label: 'Third' },
  { value: 'consolation', label: 'Consolation' },
];

const competitionPrizeOptions = [
  { value: 'champion', label: 'Overall Champion' },
  { value: 'runner_up_1', label: '1st Runner Up' },
  { value: 'runner_up_2', label: '2nd Runner Up' },
];

const PrizesPage: React.FC = () => {
  const { department, departmentLabel } = useDepartment();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [updatedPrizes, setUpdatedPrizes] = useState<Record<string, string>>({});
  const [competitionPrizes, setCompetitionPrizes] = useState<CompetitionPrize[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [updatedCompetitionPrizes, setUpdatedCompetitionPrizes] = useState<Record<string, string>>({});
  const [overallPrizes, setOverallPrizes] = useState<OverallPrizeRow[]>([]);
  const [overallCompetitionFilter, setOverallCompetitionFilter] = useState<string>('all');
  const [drillDown, setDrillDown] = useState<{ competitionId: string; name: string } | null>(null);
  const [drillRows, setDrillRows] = useState<{ id: string; name: string; admission_no: string; class: number; section: string; event: string; prize: string | null }[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [uploadingCertFor, setUploadingCertFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, role, academicYear } = useAuth();

  useEffect(() => {
    const fetchCompetitions = async () => {
      const { data } = await forceAcademicYear(
        supabase.from('competitions').select('*').eq('department', department),
        academicYear,
      ).order('competition_date', { ascending: false });
      setCompetitions(data || []);
      setIsLoading(false);
    };
    fetchCompetitions();
  }, [department, role, academicYear]);

  const fetchOverallPrizes = async () => {
    const { data: comps } = await forceAcademicYear(
      supabase.from('competitions').select('id').eq('department', department),
      academicYear,
    );
    const ids = (comps || []).map((c: any) => c.id);
    if (ids.length === 0) { setOverallPrizes([]); return; }
    const { data } = await supabase
      .from('competition_prizes')
      .select('*, student:students(*), competition:competitions(id, name, competition_date, venue)')
      .in('competition_id', ids);
    setOverallPrizes((data || []) as any);
  };

  useEffect(() => { fetchOverallPrizes(); }, [department, academicYear]);

  useEffect(() => {
    if (selectedCompetition) {
      const fetchEvents = async () => {
        const { data } = await supabase.from('events').select('*').eq('competition_id', selectedCompetition);
        setEvents(data || []);
        setSelectedEvent('');
      };
      fetchEvents();
      fetchCompetitionPrizes();
      fetchAllStudents();
    }
  }, [selectedCompetition]);

  useEffect(() => {
    if (selectedEvent) {
      const fetchParticipations = async () => {
        setIsLoading(true);
        const { data } = await supabase.from('student_participations').select('*, student:students(*)').eq('event_id', selectedEvent).order('group_number');
        setParticipations(data || []);
        setUpdatedPrizes({});
        setIsLoading(false);
      };
      fetchParticipations();
    }
  }, [selectedEvent]);

  const fetchCompetitionPrizes = async () => {
    const { data } = await supabase.from('competition_prizes').select('*, student:students(*)').eq('competition_id', selectedCompetition);
    setCompetitionPrizes(data || []);
    setUpdatedCompetitionPrizes({});
  };

  const fetchAllStudents = async () => {
    const { data } = await supabase.from('students').select('*').order('name');
    setAllStudents(data || []);
  };

  const handlePrizeChange = (participationId: string, prize: string) => {
    setUpdatedPrizes((prev) => ({ ...prev, [participationId]: prize }));
  };

  const handleCompetitionPrizeChange = (prizeType: string, studentId: string) => {
    setUpdatedCompetitionPrizes((prev) => ({ ...prev, [prizeType]: studentId }));
  };

  const handleSaveEventPrizes = async () => {
    setIsSaving(true);
    try {
      if (selectedEventData?.event_type === 'group') {
        for (const [groupKey, prize] of Object.entries(updatedPrizes)) {
          const groupNumber = parseInt(groupKey.replace('group_', ''));
          const groupParticipations = participations.filter((p: any) => p.group_number === groupNumber);
          for (const p of groupParticipations) {
            await supabase.from('student_participations').update({ prize: prize as any }).eq('id', p.id);
          }
        }
      } else {
        for (const [id, prize] of Object.entries(updatedPrizes)) {
          await supabase.from('student_participations').update({ prize: prize as any }).eq('id', id);
        }
      }
      toast({ title: 'Success', description: 'Event prizes updated successfully' });
      setUpdatedPrizes({});
      const { data } = await supabase.from('student_participations').select('*, student:students(*)').eq('event_id', selectedEvent).order('group_number');
      setParticipations(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save prizes', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCompetitionPrizes = async () => {
    setIsSaving(true);
    try {
      for (const [prizeType, studentId] of Object.entries(updatedCompetitionPrizes)) {
        if (!studentId) continue;
        const existing = competitionPrizes.find((p) => p.prize === prizeType);
        if (existing) {
          await supabase.from('competition_prizes').update({ student_id: studentId }).eq('id', existing.id);
        } else {
          await supabase.from('competition_prizes').insert({ competition_id: selectedCompetition, student_id: studentId, prize: prizeType, awarded_by: user?.id });
        }
      }
      await supabase.from('competitions').update({ is_completed: true }).eq('id', selectedCompetition);
      toast({ title: 'Success', description: 'Competition prizes updated successfully' });
      fetchCompetitionPrizes();
      fetchOverallPrizes();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save competition prizes', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCertificateUpload = async (participationId: string, file: File) => {
    setUploadingCertFor(participationId);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${participationId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('certificates')
        .getPublicUrl(filePath);

      await supabase.from('student_participations')
        .update({ certificate_url: urlData.publicUrl })
        .eq('id', participationId);

      toast({ title: 'Success', description: 'Certificate uploaded successfully' });

      // Refresh participations
      const { data } = await supabase.from('student_participations').select('*, student:students(*)').eq('event_id', selectedEvent).order('group_number');
      setParticipations(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to upload certificate', variant: 'destructive' });
    } finally {
      setUploadingCertFor(null);
    }
  };

  const triggerFileUpload = (participationId: string) => {
    setUploadingCertFor(participationId);
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingCertFor) {
      handleCertificateUpload(uploadingCertFor, file);
    }
    e.target.value = '';
  };

  const getPrizeValue = (participation: Participation) => updatedPrizes[participation.id] ?? participation.prize ?? '';
  const getCompetitionPrizeStudent = (prizeType: string) => {
    if (updatedCompetitionPrizes[prizeType]) return updatedCompetitionPrizes[prizeType];
    const existing = competitionPrizes.find((p) => p.prize === prizeType);
    return existing?.student_id || '';
  };

  const getPrizeBadgeVariant = (prize: string | null) => {
    switch (prize) {
      case 'first': case 'champion': return 'default';
      case 'second': case 'runner_up_1': return 'secondary';
      default: return 'outline';
    }
  };

  const selectedEventData = events.find((e) => e.id === selectedEvent);

  const openDrillDown = async (competitionId: string, name: string) => {
    setDrillDown({ competitionId, name });
    setDrillLoading(true);
    const { data } = await supabase
      .from('student_participations')
      .select('id, prize, student:students(name, admission_no, class, section), event:events(name)')
      .eq('competition_id', competitionId);
    setDrillRows(
      (data || []).map((p: any) => ({
        id: p.id,
        name: p.student?.name || '',
        admission_no: p.student?.admission_no || '',
        class: p.student?.class || 0,
        section: p.student?.section || '',
        event: p.event?.name || '',
        prize: p.prize,
      })).sort((a, b) => a.event.localeCompare(b.event) || a.name.localeCompare(b.name)),
    );
    setDrillLoading(false);
  };
  const showCertUpload = department === 'other';

  return (
    <DashboardLayout title={`${departmentLabel} - Prizes`}>
      <div className="space-y-6 animate-fade-in">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,.pdf"
          onChange={onFileSelected}
        />

        <div className="w-64">
          <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
            <SelectTrigger><SelectValue placeholder="Select competition" /></SelectTrigger>
            <SelectContent>
              {competitions.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        {selectedCompetition && (
          <Tabs defaultValue="events">
            <TabsList>
              <TabsTrigger value="events" className="flex items-center gap-2"><Award className="h-4 w-4" />Event Prizes</TabsTrigger>
              {department !== 'external' && (
                <TabsTrigger value="competition" className="flex items-center gap-2"><Trophy className="h-4 w-4" />Competition Prizes</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="events" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Event Prizes</CardTitle>
                      <CardDescription>Award prizes to participants in individual events</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-64">
                        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                          <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                          <SelectContent>
                            {events.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name} ({e.event_type})</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      {Object.keys(updatedPrizes).length > 0 && (
                        <Button onClick={handleSaveEventPrizes} disabled={isSaving}>
                          {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (<><Save className="mr-2 h-4 w-4" />Save Prizes</>)}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!selectedEvent ? (
                    <div className="text-center py-8 text-muted-foreground">Please select an event to update prizes</div>
                  ) : isLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : participations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No participants found for this event</div>
                  ) : selectedEventData?.event_type === 'group' ? (
                    (() => {
                      const groupMap = new Map<number, typeof participations>();
                      participations.forEach((p: any) => {
                        const gn = p.group_number || 1;
                        if (!groupMap.has(gn)) groupMap.set(gn, []);
                        groupMap.get(gn)!.push(p);
                      });
                      const sortedGroups = Array.from(groupMap.entries()).sort((a, b) => a[0] - b[0]);
                      return (
                        <div className="space-y-6">
                          {sortedGroups.map(([groupNumber, members]) => {
                            const groupPrize = updatedPrizes[`group_${groupNumber}`] ?? members[0]?.prize ?? '';
                            return (
                              <div key={groupNumber} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="font-semibold text-base">Group {groupNumber}</h3>
                                  <div className="flex items-center gap-3">
                                    {groupPrize && groupPrize !== '' && (
                                      <Badge variant={getPrizeBadgeVariant(groupPrize)}>
                                        {individualPrizeOptions.find((o) => o.value === groupPrize)?.label || groupPrize}
                                      </Badge>
                                    )}
                                    <Select value={groupPrize} onValueChange={(value) => handlePrizeChange(`group_${groupNumber}`, value)}>
                                      <SelectTrigger className="w-40"><SelectValue placeholder="Select prize" /></SelectTrigger>
                                      <SelectContent>
                                        {individualPrizeOptions.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <Table>
                                  <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Admission No.</TableHead><TableHead>Class</TableHead></TableRow></TableHeader>
                                  <TableBody>
                                    {members.map((p) => (
                                      <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.student?.name}</TableCell>
                                        <TableCell className="font-mono">{p.student?.admission_no}</TableCell>
                                        <TableCell>{p.student?.class}-{p.student?.section}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead><TableHead>Admission No.</TableHead><TableHead>Class</TableHead><TableHead>Current Prize</TableHead><TableHead>Update Prize</TableHead>
                          {showCertUpload && <TableHead>Certificate</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {participations.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.student?.name}</TableCell>
                            <TableCell className="font-mono">{p.student?.admission_no}</TableCell>
                            <TableCell>{p.student?.class}-{p.student?.section}</TableCell>
                            <TableCell>
                              {p.prize ? (<Badge variant={getPrizeBadgeVariant(p.prize)}>{individualPrizeOptions.find((o) => o.value === p.prize)?.label || p.prize}</Badge>) : (<span className="text-muted-foreground">—</span>)}
                            </TableCell>
                            <TableCell>
                              <Select value={getPrizeValue(p)} onValueChange={(value) => handlePrizeChange(p.id, value)}>
                                <SelectTrigger className="w-40"><SelectValue placeholder="Select prize" /></SelectTrigger>
                                <SelectContent>
                                  {individualPrizeOptions.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            {showCertUpload && (
                              <TableCell>
                                {p.prize ? (
                                  <div className="flex items-center gap-2">
                                    {p.certificate_url ? (
                                      <a href={p.certificate_url} target="_blank" rel="noopener noreferrer">
                                        <Badge variant="outline" className="cursor-pointer flex items-center gap-1">
                                          <FileImage className="h-3 w-3" />View
                                        </Badge>
                                      </a>
                                    ) : null}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => triggerFileUpload(p.id)}
                                      disabled={uploadingCertFor === p.id}
                                    >
                                      {uploadingCertFor === p.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <><Upload className="h-4 w-4 mr-1" />{p.certificate_url ? 'Replace' : 'Upload'}</>
                                      )}
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">Assign prize first</span>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {department !== 'external' && (
            <TabsContent value="competition" className="mt-6">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />Competitions With Overall Prizes</CardTitle>
                  <CardDescription>All {departmentLabel.toLowerCase()} competitions where our school secured overall prizes this academic year</CardDescription>
                </CardHeader>
                <CardContent>
                  {overallPrizes.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">No overall prizes recorded yet</div>
                  ) : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Competition</TableHead><TableHead>Overall Prizes Secured</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {Array.from(
                          overallPrizes.reduce((map, p) => {
                            const key = p.competition_id;
                            if (!map.has(key)) map.set(key, { name: p.competition?.name || 'Competition', rows: [] as OverallPrizeRow[] });
                            map.get(key)!.rows.push(p);
                            return map;
                          }, new Map<string, { name: string; rows: OverallPrizeRow[] }>()),
                        ).map(([compId, group]) => (
                          <TableRow key={compId}>
                            <TableCell className="font-medium">{group.name}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                {group.rows.map((p) => (
                                  <Badge key={p.id} variant={getPrizeBadgeVariant(p.prize)}>
                                    {competitionPrizeOptions.find((o) => o.value === p.prize)?.label || p.prize}
                                    {p.student ? ` — ${p.student.name}` : ''}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />Competition Overall Prizes</CardTitle>
                      <CardDescription>Award overall competition prizes (Overall Champion, 1st Runner Up, 2nd Runner Up)</CardDescription>
                    </div>
                    {Object.keys(updatedCompetitionPrizes).length > 0 && (
                      <Button onClick={handleSaveCompetitionPrizes} disabled={isSaving}>
                        {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (<><Save className="mr-2 h-4 w-4" />Save Competition Prizes</>)}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Prize</TableHead><TableHead>Current Winner</TableHead><TableHead>Update</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {competitionPrizeOptions.map((prizeOption) => {
                        const currentPrize = competitionPrizes.find((p) => p.prize === prizeOption.value);
                        return (
                          <TableRow key={prizeOption.value}>
                            <TableCell><Badge variant={getPrizeBadgeVariant(prizeOption.value)}>{prizeOption.label}</Badge></TableCell>
                            <TableCell>
                              {currentPrize?.student ? (<span className="font-medium">{currentPrize.student.name} ({currentPrize.student.class}-{currentPrize.student.section})</span>) : (<span className="text-muted-foreground">Not assigned</span>)}
                            </TableCell>
                            <TableCell>
                              <Select value={getCompetitionPrizeStudent(prizeOption.value)} onValueChange={(value) => handleCompetitionPrizeChange(prizeOption.value, value)}>
                                <SelectTrigger className="w-64"><SelectValue placeholder="Select student" /></SelectTrigger>
                                <SelectContent>
                                  {allStudents.map((student) => (<SelectItem key={student.id} value={student.id}>{student.name} ({student.class}-{student.section})</SelectItem>))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PrizesPage;
