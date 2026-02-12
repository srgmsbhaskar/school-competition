import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, Trophy, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Competition {
  id: string;
  name: string;
  is_completed: boolean;
}

interface Event {
  id: string;
  name: string;
  competition_id: string;
  event_type: 'solo' | 'group';
}

interface Participation {
  id: string;
  student_id: string;
  event_id: string;
  prize: string | null;
  student: {
    id: string;
    name: string;
    admission_no: string;
    class: number;
    section: string;
  };
}

interface Student {
  id: string;
  name: string;
  admission_no: string;
  class: number;
  section: string;
}

interface CompetitionPrize {
  id: string;
  competition_id: string;
  student_id: string;
  prize: string;
  student?: Student;
}

// Individual event prizes (for solo events)
const individualPrizeOptions = [
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
  { value: 'third', label: 'Third' },
  { value: 'consolation', label: 'Consolation' },
];

// Competition-level prizes
const competitionPrizeOptions = [
  { value: 'champion', label: 'Overall Champion' },
  { value: 'runner_up_1', label: '1st Runner Up' },
  { value: 'runner_up_2', label: '2nd Runner Up' },
];

const PrizesPage: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [updatedPrizes, setUpdatedPrizes] = useState<Record<string, string>>({});
  
  // Competition prizes state
  const [competitionPrizes, setCompetitionPrizes] = useState<CompetitionPrize[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [updatedCompetitionPrizes, setUpdatedCompetitionPrizes] = useState<Record<string, string>>({});
  
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetchCompetitions = async () => {
      const { data } = await supabase
        .from('competitions')
        .select('*')
        .order('competition_date', { ascending: false });
      setCompetitions(data || []);
      setIsLoading(false);
    };
    fetchCompetitions();
  }, []);

  useEffect(() => {
    if (selectedCompetition) {
      const fetchEvents = async () => {
        const { data } = await supabase
          .from('events')
          .select('*')
          .eq('competition_id', selectedCompetition);
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
        const { data } = await supabase
          .from('student_participations')
          .select('*, student:students(*)')
          .eq('event_id', selectedEvent);
        setParticipations(data || []);
        setUpdatedPrizes({});
        setIsLoading(false);
      };
      fetchParticipations();
    }
  }, [selectedEvent]);

  const fetchCompetitionPrizes = async () => {
    const { data } = await supabase
      .from('competition_prizes')
      .select('*, student:students(*)')
      .eq('competition_id', selectedCompetition);
    setCompetitionPrizes(data || []);
    setUpdatedCompetitionPrizes({});
  };

  const fetchAllStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('name');
    setAllStudents(data || []);
  };

  const handlePrizeChange = (participationId: string, prize: string) => {
    setUpdatedPrizes((prev) => ({
      ...prev,
      [participationId]: prize,
    }));
  };

  const handleCompetitionPrizeChange = (prizeType: string, studentId: string) => {
    setUpdatedCompetitionPrizes((prev) => ({
      ...prev,
      [prizeType]: studentId,
    }));
  };

  const handleSaveEventPrizes = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(updatedPrizes).map(([id, prize]) => ({
        id,
        prize,
      }));

      for (const update of updates) {
        await supabase
          .from('student_participations')
          .update({ prize: update.prize as any })
          .eq('id', update.id);
      }

      toast({
        title: 'Success',
        description: 'Event prizes updated successfully',
      });

      setUpdatedPrizes({});
      
      // Refresh participations
      const { data } = await supabase
        .from('student_participations')
        .select('*, student:students(*)')
        .eq('event_id', selectedEvent);
      setParticipations(data || []);
    } catch (error: any) {
      console.error('Error saving prizes:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save prizes',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCompetitionPrizes = async () => {
    setIsSaving(true);
    try {
      for (const [prizeType, studentId] of Object.entries(updatedCompetitionPrizes)) {
        if (!studentId) continue;
        
        // Check if this prize already exists
        const existing = competitionPrizes.find((p) => p.prize === prizeType);
        
        if (existing) {
          await supabase
            .from('competition_prizes')
            .update({ student_id: studentId })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('competition_prizes')
            .insert({
              competition_id: selectedCompetition,
              student_id: studentId,
              prize: prizeType,
              awarded_by: user?.id,
            });
        }
      }

      // Mark competition as completed
      await supabase
        .from('competitions')
        .update({ is_completed: true })
        .eq('id', selectedCompetition);

      toast({
        title: 'Success',
        description: 'Competition prizes updated successfully',
      });

      fetchCompetitionPrizes();
    } catch (error: any) {
      console.error('Error saving competition prizes:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save competition prizes',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getPrizeValue = (participation: Participation) => {
    return updatedPrizes[participation.id] ?? participation.prize ?? '';
  };

  const getCompetitionPrizeStudent = (prizeType: string) => {
    if (updatedCompetitionPrizes[prizeType]) {
      return updatedCompetitionPrizes[prizeType];
    }
    const existing = competitionPrizes.find((p) => p.prize === prizeType);
    return existing?.student_id || '';
  };

  const getPrizeBadgeVariant = (prize: string | null) => {
    switch (prize) {
      case 'first':
      case 'champion':
        return 'default';
      case 'second':
      case 'runner_up_1':
        return 'secondary';
      case 'third':
      case 'runner_up_2':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const selectedEventData = events.find((e) => e.id === selectedEvent);

  return (
    <DashboardLayout title="Prizes">
      <div className="space-y-6 animate-fade-in">
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
          <Tabs defaultValue="events">
            <TabsList>
              <TabsTrigger value="events" className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                Event Prizes
              </TabsTrigger>
              <TabsTrigger value="competition" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Competition Prizes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Event Prizes</CardTitle>
                      <CardDescription>
                        Award prizes to participants in individual events
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-64">
                        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select event" />
                          </SelectTrigger>
                          <SelectContent>
                            {events.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.name} ({e.event_type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {Object.keys(updatedPrizes).length > 0 && (
                        <Button onClick={handleSaveEventPrizes} disabled={isSaving}>
                          {isSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Prizes
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!selectedEvent ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Please select an event to update prizes
                    </div>
                  ) : isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : participations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No participants found for this event
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Admission No.</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Current Prize</TableHead>
                          <TableHead>Update Prize</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {participations.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.student?.name}</TableCell>
                            <TableCell className="font-mono">{p.student?.admission_no}</TableCell>
                            <TableCell>
                              {p.student?.class}-{p.student?.section}
                            </TableCell>
                            <TableCell>
                              {p.prize ? (
                                <Badge variant={getPrizeBadgeVariant(p.prize)}>
                                  {individualPrizeOptions.find((o) => o.value === p.prize)?.label || p.prize}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={getPrizeValue(p)}
                                onValueChange={(value) => handlePrizeChange(p.id, value)}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue placeholder="Select prize" />
                                </SelectTrigger>
                                <SelectContent>
                                  {individualPrizeOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
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
            </TabsContent>

            <TabsContent value="competition" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-primary" />
                        Competition Overall Prizes
                      </CardTitle>
                      <CardDescription>
                        Award overall competition prizes (Winner, Runner Up 1, Runner Up 2)
                      </CardDescription>
                    </div>
                    {Object.keys(updatedCompetitionPrizes).length > 0 && (
                      <Button onClick={handleSaveCompetitionPrizes} disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Competition Prizes
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prize</TableHead>
                        <TableHead>Current Winner</TableHead>
                        <TableHead>Update</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {competitionPrizeOptions.map((prizeOption) => {
                        const currentPrize = competitionPrizes.find((p) => p.prize === prizeOption.value);
                        return (
                          <TableRow key={prizeOption.value}>
                            <TableCell>
                              <Badge variant={getPrizeBadgeVariant(prizeOption.value)}>
                                {prizeOption.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {currentPrize?.student ? (
                                <span className="font-medium">
                                  {currentPrize.student.name} ({currentPrize.student.class}-{currentPrize.student.section})
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Not assigned</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={getCompetitionPrizeStudent(prizeOption.value)}
                                onValueChange={(value) => handleCompetitionPrizeChange(prizeOption.value, value)}
                              >
                                <SelectTrigger className="w-64">
                                  <SelectValue placeholder="Select student" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allStudents.map((student) => (
                                    <SelectItem key={student.id} value={student.id}>
                                      {student.name} ({student.class}-{student.section})
                                    </SelectItem>
                                  ))}
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
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PrizesPage;
