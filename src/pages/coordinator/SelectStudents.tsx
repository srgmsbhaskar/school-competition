import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Users, Search, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useDepartment } from '@/hooks/useDepartment';
import { forceAcademicYear } from '@/lib/academicYear';

interface Competition { id: string; name: string; }
interface Event { id: string; name: string; event_type: 'solo' | 'group'; classes: number[]; }
interface Student { id: string; s_no: number; admission_no: string; name: string; class: number; section: string; }
interface GroupData { groupNumber: number; studentIds: Set<string>; }

const CoordinatorSelectStudents: React.FC = () => {
  const { department, departmentLabel } = useDepartment();
  const [searchParams] = useSearchParams();
  const initialCompetitionId = searchParams.get('competition');

  const { user, academicYear, role } = useAuth();
  const { toast } = useToast();

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>(initialCompetitionId || '');
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number>(0);

  const selectedEventData = events.find((e) => e.id === selectedEvent);
  const isGroupEvent = selectedEventData?.event_type === 'group';

  useEffect(() => {
    const fetchCompetitions = async () => {
      const { data } = await forceAcademicYear(
        supabase
          .from('competitions')
          .select('id, name, competition_date')
          .eq('department', department),
        academicYear,
      ).order('competition_date', { ascending: false });
      setCompetitions(data || []);
      setIsLoading(false);
    };
    fetchCompetitions();
  }, [department, role, academicYear]);

  useEffect(() => {
    if (selectedCompetition) fetchEvents();
  }, [selectedCompetition]);

  useEffect(() => {
    if (selectedEvent) {
      fetchStudentsForEvent();
      fetchExistingParticipations();
    }
  }, [selectedEvent]);

  const fetchEvents = async () => {
    setIsLoading(true);
    setSelectedEvent('');
    setStudents([]);
    setGroups([]);

    const { data: eventsData } = await supabase.from('events').select('id, name, event_type').eq('competition_id', selectedCompetition);
    const { data: eventClassesData } = await supabase.from('event_classes').select('event_id, class');

    const eventsWithClasses = (eventsData || []).map((event) => ({
      ...event,
      event_type: event.event_type as 'solo' | 'group',
      classes: (eventClassesData || []).filter((ec) => ec.event_id === event.id).map((ec) => ec.class),
    }));

    setEvents(eventsWithClasses);
    setIsLoading(false);
  };

  const fetchStudentsForEvent = async () => {
    setIsLoading(true);
    const event = events.find((e) => e.id === selectedEvent);
    if (!event) { setIsLoading(false); return; }

    let query = supabase.from('students').select('*').order('class').order('section').order('s_no');
    if (event.classes.length > 0) query = query.in('class', event.classes);
    // Filter by academic year for dept_incharge and teacher roles
    if (role === 'department_incharge' || role === 'teacher') {
      query = query.eq('academic_year', academicYear);
    }
    const { data: studentsData } = await query;
    setStudents(studentsData || []);
    setIsLoading(false);
  };

  const fetchExistingParticipations = async () => {
    const { data } = await supabase.from('student_participations').select('student_id, event_id, group_number').eq('event_id', selectedEvent);
    const event = events.find((e) => e.id === selectedEvent);

    if (event?.event_type === 'group') {
      const groupMap = new Map<number, Set<string>>();
      (data || []).forEach((p) => {
        const gn = p.group_number || 1;
        if (!groupMap.has(gn)) groupMap.set(gn, new Set());
        groupMap.get(gn)!.add(p.student_id);
      });
      if (groupMap.size === 0) {
        setGroups([{ groupNumber: 1, studentIds: new Set() }]);
        setActiveGroupIndex(0);
      } else {
        const sortedGroups = Array.from(groupMap.entries()).sort((a, b) => a[0] - b[0]).map(([gn, ids]) => ({ groupNumber: gn, studentIds: ids }));
        setGroups(sortedGroups);
        setActiveGroupIndex(0);
      }
      setSelectedStudents(new Set());
    } else {
      const participatingStudentIds = new Set((data || []).map((p) => p.student_id));
      setSelectedStudents(participatingStudentIds);
      setGroups([]);
    }
  };

  const handleStudentToggle = (studentId: string) => {
    if (isGroupEvent) {
      setGroups((prev) => {
        const updated = [...prev];
        const group = updated[activeGroupIndex];
        const newIds = new Set(group.studentIds);
        if (newIds.has(studentId)) newIds.delete(studentId); else newIds.add(studentId);
        updated[activeGroupIndex] = { ...group, studentIds: newIds };
        return updated;
      });
    } else {
      setSelectedStudents((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(studentId)) newSet.delete(studentId); else newSet.add(studentId);
        return newSet;
      });
    }
  };

  const addGroup = () => {
    const nextNumber = groups.length > 0 ? Math.max(...groups.map((g) => g.groupNumber)) + 1 : 1;
    setGroups((prev) => [...prev, { groupNumber: nextNumber, studentIds: new Set() }]);
    setActiveGroupIndex(groups.length);
  };

  const removeGroup = (index: number) => {
    if (groups.length <= 1) return;
    setGroups((prev) => prev.filter((_, i) => i !== index));
    setActiveGroupIndex((prev) => Math.min(prev, groups.length - 2));
  };

  const handleSave = async () => {
    if (!selectedEvent || !selectedCompetition) return;
    setIsSaving(true);
    try {
      await supabase.from('student_participations').delete().eq('event_id', selectedEvent);
      if (isGroupEvent) {
        const inserts: any[] = [];
        groups.forEach((group) => {
          group.studentIds.forEach((studentId) => {
            inserts.push({ student_id: studentId, event_id: selectedEvent, competition_id: selectedCompetition, selected_by: user?.id, group_number: group.groupNumber });
          });
        });
        if (inserts.length > 0) await supabase.from('student_participations').insert(inserts);
      } else {
        if (selectedStudents.size > 0) {
          await supabase.from('student_participations').insert(
            [...selectedStudents].map((studentId) => ({ student_id: studentId, event_id: selectedEvent, competition_id: selectedCompetition, selected_by: user?.id }))
          );
        }
      }
      toast({ title: 'Success', description: 'Student selections saved successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save selections', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const getFilteredStudents = () => {
    let filtered = students;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q));
    }
    return filtered;
  };

  const isStudentSelected = (studentId: string) => {
    if (isGroupEvent) return groups[activeGroupIndex]?.studentIds.has(studentId) || false;
    return selectedStudents.has(studentId);
  };

  const isStudentInAnotherGroup = (studentId: string) => {
    if (!isGroupEvent) return false;
    return groups.some((g, i) => i !== activeGroupIndex && g.studentIds.has(studentId));
  };

  const totalGroupStudents = groups.reduce((sum, g) => sum + g.studentIds.size, 0);
  const filteredStudents = getFilteredStudents();

  return (
    <DashboardLayout title={`${departmentLabel} - Select Students`}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-64">
            <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
              <SelectTrigger><SelectValue placeholder="Select competition" /></SelectTrigger>
              <SelectContent>
                {competitions.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {selectedCompetition && (
            <div className="w-64">
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                <SelectContent>
                  {events.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name} ({e.event_type})</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          {selectedEvent && (
            <Button onClick={handleSave} disabled={isSaving} className="ml-auto">
              {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (<><Save className="mr-2 h-4 w-4" />Save Selections ({isGroupEvent ? totalGroupStudents : selectedStudents.size})</>)}
            </Button>
          )}
        </div>

        {isGroupEvent && selectedEvent && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Groups</CardTitle>
                <Button variant="outline" size="sm" onClick={addGroup}><Plus className="mr-2 h-4 w-4" />Add Group</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {groups.map((group, index) => (
                  <div key={group.groupNumber} className="flex items-center gap-1">
                    <Button variant={activeGroupIndex === index ? 'default' : 'outline'} size="sm" onClick={() => setActiveGroupIndex(index)}>
                      Group {group.groupNumber} ({group.studentIds.size})
                    </Button>
                    {groups.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeGroup(index)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {isGroupEvent ? `Select Students for Group ${groups[activeGroupIndex]?.groupNumber || 1}` : 'Select Students'}
                </CardTitle>
                <CardDescription>
                  {isGroupEvent ? 'Add students to the selected group. Students already in another group are dimmed.' : 'Choose students for this event'}
                </CardDescription>
              </div>
              {selectedEvent && (
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedCompetition ? (
              <div className="text-center py-8 text-muted-foreground">Please select a competition to view students</div>
            ) : !selectedEvent ? (
              <div className="text-center py-8 text-muted-foreground">Please select an event to select students</div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{searchQuery ? 'No students match your search' : 'No eligible students found for this event'}</div>
            ) : (
              <div className="rounded-md border max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>S.No</TableHead>
                      <TableHead>Admission No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Section</TableHead>
                      {isGroupEvent && <TableHead>Group</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => {
                      const inAnotherGroup = isStudentInAnotherGroup(student.id);
                      const assignedGroup = isGroupEvent ? groups.find((g) => g.studentIds.has(student.id)) : null;
                      return (
                        <TableRow key={student.id} className={inAnotherGroup ? 'opacity-50' : ''}>
                          <TableCell><Checkbox checked={isStudentSelected(student.id)} onCheckedChange={() => handleStudentToggle(student.id)} disabled={inAnotherGroup} /></TableCell>
                          <TableCell>{student.s_no}</TableCell>
                          <TableCell className="font-mono">{student.admission_no}</TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>{student.class}</TableCell>
                          <TableCell>{student.section}</TableCell>
                          {isGroupEvent && (
                            <TableCell>
                              {assignedGroup ? (<Badge variant="outline">Group {assignedGroup.groupNumber}</Badge>) : (<span className="text-muted-foreground">—</span>)}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CoordinatorSelectStudents;
