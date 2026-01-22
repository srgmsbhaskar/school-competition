import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Competition {
  id: string;
  name: string;
}

interface Event {
  id: string;
  name: string;
  classes: number[];
}

interface Student {
  id: string;
  s_no: number;
  admission_no: string;
  name: string;
  class: number;
  section: string;
}

interface Participation {
  student_id: string;
  event_id: string;
}

const SelectStudents: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialCompetitionId = searchParams.get('competition');
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>(initialCompetitionId || '');
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [assignedClasses, setAssignedClasses] = useState<number[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [existingParticipations, setExistingParticipations] = useState<Participation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchAssignedCompetitions = async () => {
      if (!user) return;

      const { data: assignments } = await supabase
        .from('teacher_assignments')
        .select('competition_id, class')
        .eq('teacher_id', user.id);

      if (!assignments || assignments.length === 0) {
        setIsLoading(false);
        return;
      }

      const competitionIds = [...new Set(assignments.map((a) => a.competition_id))];

      const { data: competitionsData } = await supabase
        .from('competitions')
        .select('id, name')
        .in('id', competitionIds);

      setCompetitions(competitionsData || []);

      if (selectedCompetition) {
        const classes = assignments
          .filter((a) => a.competition_id === selectedCompetition)
          .map((a) => a.class);
        setAssignedClasses(classes);
      }

      setIsLoading(false);
    };

    fetchAssignedCompetitions();
  }, [user, selectedCompetition]);

  useEffect(() => {
    if (selectedCompetition && user) {
      fetchEventsAndStudents();
    }
  }, [selectedCompetition]);

  useEffect(() => {
    if (selectedEvent) {
      fetchExistingParticipations();
    }
  }, [selectedEvent]);

  const fetchEventsAndStudents = async () => {
    setIsLoading(true);

    // Get teacher assignments for this competition
    const { data: assignments } = await supabase
      .from('teacher_assignments')
      .select('class')
      .eq('teacher_id', user?.id)
      .eq('competition_id', selectedCompetition);

    const classes = assignments?.map((a) => a.class) || [];
    setAssignedClasses(classes);

    // Get events for this competition
    const { data: eventsData } = await supabase
      .from('events')
      .select('id, name')
      .eq('competition_id', selectedCompetition);

    const { data: eventClassesData } = await supabase
      .from('event_classes')
      .select('event_id, class');

    const eventsWithClasses = (eventsData || []).map((event) => ({
      ...event,
      classes: (eventClassesData || [])
        .filter((ec) => ec.event_id === event.id)
        .map((ec) => ec.class),
    }));

    // Filter events that include at least one of teacher's assigned classes
    const filteredEvents = eventsWithClasses.filter((event) =>
      event.classes.length === 0 || event.classes.some((c) => classes.includes(c))
    );

    setEvents(filteredEvents);

    // Get students from assigned classes
    if (classes.length > 0) {
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .in('class', classes)
        .order('class')
        .order('section')
        .order('s_no');

      setStudents(studentsData || []);
    }

    setIsLoading(false);
  };

  const fetchExistingParticipations = async () => {
    const { data } = await supabase
      .from('student_participations')
      .select('student_id, event_id')
      .eq('event_id', selectedEvent);

    setExistingParticipations(data || []);
    
    // Set selected students based on existing participations
    const participatingStudentIds = new Set((data || []).map((p) => p.student_id));
    setSelectedStudents(participatingStudentIds);
  };

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!selectedEvent || !selectedCompetition) return;

    setIsSaving(true);
    try {
      // Get current participations for this event
      const { data: currentParticipations } = await supabase
        .from('student_participations')
        .select('id, student_id')
        .eq('event_id', selectedEvent);

      const currentStudentIds = new Set((currentParticipations || []).map((p) => p.student_id));
      
      // Find students to add
      const toAdd = [...selectedStudents].filter((id) => !currentStudentIds.has(id));
      
      // Find students to remove
      const toRemove = (currentParticipations || [])
        .filter((p) => !selectedStudents.has(p.student_id))
        .map((p) => p.id);

      // Add new participations
      if (toAdd.length > 0) {
        const newParticipations = toAdd.map((studentId) => ({
          student_id: studentId,
          event_id: selectedEvent,
          competition_id: selectedCompetition,
          selected_by: user?.id,
        }));

        await supabase.from('student_participations').insert(newParticipations);
      }

      // Remove participations
      if (toRemove.length > 0) {
        await supabase.from('student_participations').delete().in('id', toRemove);
      }

      toast({
        title: 'Success',
        description: 'Student selections saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving selections:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save selections',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getEligibleStudents = () => {
    if (!selectedEvent) return students;

    const event = events.find((e) => e.id === selectedEvent);
    if (!event || event.classes.length === 0) return students;

    return students.filter((s) => event.classes.includes(s.class));
  };

  const eligibleStudents = getEligibleStudents();

  return (
    <DashboardLayout title="Select Students">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4 flex-wrap">
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
            <div className="w-64">
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedEvent && (
            <Button onClick={handleSave} disabled={isSaving} className="ml-auto">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Selections ({selectedStudents.size})
                </>
              )}
            </Button>
          )}
        </div>

        {assignedClasses.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Your assigned classes:</span>
            {assignedClasses.map((c) => (
              <Badge key={c} variant="outline">
                Class {c}
              </Badge>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Students
            </CardTitle>
            <CardDescription>
              Choose students from your assigned classes for this event
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedCompetition ? (
              <div className="text-center py-8 text-muted-foreground">
                Please select a competition to view students
              </div>
            ) : !selectedEvent ? (
              <div className="text-center py-8 text-muted-foreground">
                Please select an event to select students
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : eligibleStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No eligible students found for this event
              </div>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eligibleStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedStudents.has(student.id)}
                            onCheckedChange={() => handleStudentToggle(student.id)}
                          />
                        </TableCell>
                        <TableCell>{student.s_no}</TableCell>
                        <TableCell className="font-mono">{student.admission_no}</TableCell>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{student.class}</TableCell>
                        <TableCell>{student.section}</TableCell>
                      </TableRow>
                    ))}
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

export default SelectStudents;
