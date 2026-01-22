import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Competition {
  id: string;
  name: string;
}

interface Teacher {
  id: string;
  email: string;
  full_name: string;
}

interface Assignment {
  teacher_id: string;
  competition_id: string;
  class: number;
}

const AssignTeachers: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const classes = Array.from({ length: 12 }, (_, i) => i + 1);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [competitionsRes, profilesRes, rolesRes] = await Promise.all([
        supabase.from('competitions').select('id, name').order('competition_date', { ascending: false }),
        supabase.from('profiles').select('id, email, full_name'),
        supabase.from('user_roles').select('*').eq('role', 'teacher'),
      ]);

      setCompetitions(competitionsRes.data || []);
      
      // Filter only teachers
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
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCompetition]);

  const getAssignedTeacher = (classNum: number): string => {
    const assignment = assignments.find((a) => a.class === classNum);
    return assignment?.teacher_id || '';
  };

  const handleAssignmentChange = (classNum: number, teacherId: string) => {
    setAssignments((prev) => {
      const existing = prev.find((a) => a.class === classNum);
      if (existing) {
        if (!teacherId) {
          return prev.filter((a) => a.class !== classNum);
        }
        return prev.map((a) =>
          a.class === classNum ? { ...a, teacher_id: teacherId } : a
        );
      }
      if (teacherId) {
        return [...prev, { teacher_id: teacherId, competition_id: selectedCompetition, class: classNum }];
      }
      return prev;
    });
  };

  const handleSave = async () => {
    if (!selectedCompetition) return;
    
    setIsSaving(true);
    try {
      // Delete existing assignments
      await supabase
        .from('teacher_assignments')
        .delete()
        .eq('competition_id', selectedCompetition);

      // Insert new assignments
      if (assignments.length > 0) {
        const { error } = await supabase
          .from('teacher_assignments')
          .insert(assignments);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Teacher assignments saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving assignments:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save assignments',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout title="Assign Teachers">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
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
          
          {selectedCompetition && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Assignments
                </>
              )}
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Teacher Assignments</CardTitle>
            <CardDescription>
              Assign teachers to manage student selection for each class
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedCompetition ? (
              <div className="text-center py-8 text-muted-foreground">
                Please select a competition to assign teachers
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : teachers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No teachers found. Please create teacher accounts first.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Assigned Teacher</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((classNum) => (
                    <TableRow key={classNum}>
                      <TableCell>
                        <Badge variant="outline">Class {classNum}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={getAssignedTeacher(classNum)}
                          onValueChange={(value) => handleAssignmentChange(classNum, value)}
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue placeholder="Select teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No teacher assigned</SelectItem>
                            {teachers.map((teacher) => (
                              <SelectItem key={teacher.id} value={teacher.id}>
                                {teacher.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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

export default AssignTeachers;
