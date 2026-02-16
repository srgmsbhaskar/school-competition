import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDepartment } from '@/hooks/useDepartment';
import { logAudit } from '@/lib/auditLog';

interface Competition { id: string; name: string; competition_date: string; }
interface Teacher { id: string; email: string; full_name: string; }
interface Assignment { teacher_id: string; competition_id: string; class: number; }
interface DutyConflict { teacherName: string; competitionName: string; date: string; }

const AssignTeachers: React.FC = () => {
  const { department, departmentLabel } = useDepartment();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [conflicts, setConflicts] = useState<Record<string, DutyConflict>>({});
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [allCompetitions, setAllCompetitions] = useState<Competition[]>([]);
  const { toast } = useToast();

  const classes = Array.from({ length: 12 }, (_, i) => i + 1);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [competitionsRes, profilesRes, rolesRes, allAssignmentsRes, allCompRes] = await Promise.all([
        supabase.from('competitions').select('id, name, competition_date').eq('department', department).order('competition_date', { ascending: false }),
        supabase.from('profiles').select('id, email, full_name'),
        supabase.from('user_roles').select('*').eq('role', 'teacher'),
        supabase.from('teacher_assignments').select('*'),
        supabase.from('competitions').select('id, name, competition_date'),
      ]);

      setCompetitions(competitionsRes.data || []);
      setAllCompetitions(allCompRes.data || []);
      setAllAssignments(allAssignmentsRes.data || []);

      const teacherIds = (rolesRes.data || []).map((r) => r.user_id);
      const teacherProfiles = (profilesRes.data || []).filter((p) => teacherIds.includes(p.id));
      setTeachers(teacherProfiles);

      if (selectedCompetition) {
        const { data: assignmentsData } = await supabase
          .from('teacher_assignments')
          .select('*')
          .eq('competition_id', selectedCompetition);
        setAssignments(assignmentsData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedCompetition, department]);

  const getAssignedTeacher = (classNum: number): string => {
    const assignment = assignments.find((a) => a.class === classNum);
    return assignment?.teacher_id || '';
  };

  const checkDutyConflict = (teacherId: string): DutyConflict | null => {
    if (!selectedCompetition || !teacherId) return null;

    const currentComp = competitions.find(c => c.id === selectedCompetition);
    if (!currentComp) return null;

    const currentDate = currentComp.competition_date;

    // Find other competitions on the same date where this teacher is assigned
    const otherAssignments = allAssignments.filter(
      a => a.teacher_id === teacherId && a.competition_id !== selectedCompetition
    );

    for (const a of otherAssignments) {
      const otherComp = allCompetitions.find(c => c.id === a.competition_id);
      if (otherComp && otherComp.competition_date === currentDate) {
        const teacher = teachers.find(t => t.id === teacherId);
        return {
          teacherName: teacher?.full_name || '',
          competitionName: otherComp.name,
          date: currentDate,
        };
      }
    }
    return null;
  };

  const handleAssignmentChange = (classNum: number, teacherId: string) => {
    // Check for duty conflict
    if (teacherId && teacherId !== 'none') {
      const conflict = checkDutyConflict(teacherId);
      if (conflict) {
        toast({
          title: '⚠️ Duty Conflict!',
          description: `${conflict.teacherName} already has assigned duty on ${new Date(conflict.date).toLocaleDateString()} for "${conflict.competitionName}"`,
          variant: 'destructive',
        });
        setConflicts(prev => ({ ...prev, [`${classNum}`]: conflict }));
      } else {
        setConflicts(prev => {
          const updated = { ...prev };
          delete updated[`${classNum}`];
          return updated;
        });
      }
    } else {
      setConflicts(prev => {
        const updated = { ...prev };
        delete updated[`${classNum}`];
        return updated;
      });
    }

    setAssignments((prev) => {
      const existing = prev.find((a) => a.class === classNum);
      if (existing) {
        if (!teacherId || teacherId === 'none') return prev.filter((a) => a.class !== classNum);
        return prev.map((a) => a.class === classNum ? { ...a, teacher_id: teacherId } : a);
      }
      if (teacherId && teacherId !== 'none') return [...prev, { teacher_id: teacherId, competition_id: selectedCompetition, class: classNum }];
      return prev;
    });
  };

  const handleSave = async () => {
    if (!selectedCompetition) return;
    setIsSaving(true);
    try {
      await supabase.from('teacher_assignments').delete().eq('competition_id', selectedCompetition);
      if (assignments.length > 0) {
        const { error } = await supabase.from('teacher_assignments').insert(assignments);
        if (error) throw error;
      }
      await logAudit('teacher_assignments_updated', `Updated teacher assignments for competition ${selectedCompetition}`);
      toast({ title: 'Success', description: 'Teacher assignments saved successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save assignments', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout title={`${departmentLabel} - Assign Teachers`}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="w-64">
            <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
              <SelectTrigger><SelectValue placeholder="Select competition" /></SelectTrigger>
              <SelectContent>
                {competitions.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {selectedCompetition && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (<><Save className="mr-2 h-4 w-4" />Save Assignments</>)}
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Teacher Assignments</CardTitle>
            <CardDescription>Assign teachers to manage student selection for each class</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedCompetition ? (
              <div className="text-center py-8 text-muted-foreground">Please select a competition to assign teachers</div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : teachers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No teachers found. Please create teacher accounts first.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Assigned Teacher</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((classNum) => {
                    const conflict = conflicts[`${classNum}`];
                    return (
                      <TableRow key={classNum} className={conflict ? 'bg-destructive/5' : ''}>
                        <TableCell><Badge variant="outline">Class {classNum}</Badge></TableCell>
                        <TableCell>
                          <Select value={getAssignedTeacher(classNum) || "none"} onValueChange={(value) => handleAssignmentChange(classNum, value)}>
                            <SelectTrigger className="w-64"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No teacher assigned</SelectItem>
                              {teachers.map((teacher) => (<SelectItem key={teacher.id} value={teacher.id}>{teacher.full_name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {conflict && (
                            <div className="flex items-center gap-1 text-destructive text-xs">
                              <AlertTriangle className="h-3 w-3" />
                              <span>Duty conflict: {conflict.competitionName}</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AssignTeachers;
