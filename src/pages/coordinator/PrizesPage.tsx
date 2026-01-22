import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Competition {
  id: string;
  name: string;
  is_completed: boolean;
}

interface Event {
  id: string;
  name: string;
  competition_id: string;
}

interface Participation {
  id: string;
  student_id: string;
  event_id: string;
  prize: string | null;
  student: {
    name: string;
    admission_no: string;
    class: number;
    section: string;
  };
}

const prizeOptions = [
  { value: 'participation', label: 'Participation' },
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
  { value: 'runner_up_1', label: 'Runner Up 1' },
  { value: 'runner_up_2', label: 'Runner Up 2' },
  { value: 'third', label: 'Third' },
  { value: 'consolation', label: 'Consolation' },
  { value: 'champion', label: 'Champion' },
  { value: 'other', label: 'Other' },
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
  const { toast } = useToast();

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

  const handlePrizeChange = (participationId: string, prize: string) => {
    setUpdatedPrizes((prev) => ({
      ...prev,
      [participationId]: prize,
    }));
  };

  const handleSave = async () => {
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

      // Mark competition as completed if needed
      if (selectedCompetition) {
        await supabase
          .from('competitions')
          .update({ is_completed: true })
          .eq('id', selectedCompetition);
      }

      toast({
        title: 'Success',
        description: 'Prizes updated successfully',
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

  const getPrizeValue = (participation: Participation) => {
    return updatedPrizes[participation.id] ?? participation.prize ?? '';
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

  return (
    <DashboardLayout title="Prizes">
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

          {Object.keys(updatedPrizes).length > 0 && (
            <Button onClick={handleSave} disabled={isSaving} className="ml-auto">
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

        <Card>
          <CardHeader>
            <CardTitle>Update Prizes</CardTitle>
            <CardDescription>
              Award prizes to participating students
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedEvent ? (
              <div className="text-center py-8 text-muted-foreground">
                Please select a competition and event to update prizes
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
                            {prizeOptions.find((o) => o.value === p.prize)?.label || p.prize}
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
                            {prizeOptions.map((option) => (
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
      </div>
    </DashboardLayout>
  );
};

export default PrizesPage;
