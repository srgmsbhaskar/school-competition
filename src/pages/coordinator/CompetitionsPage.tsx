import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Eye, Calendar, MapPin, Trash2, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface CompetitionPrize {
  id: string;
  prize: string;
  student: { name: string; class: number; section: string } | null;
}

interface Competition {
  id: string;
  name: string;
  competition_date: string;
  venue: string;
  is_completed: boolean;
  created_at: string;
  prizes?: CompetitionPrize[];
}

const CompetitionsPage: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCompetition, setNewCompetition] = useState({
    name: '',
    competition_date: '',
    venue: '',
  });
  const { toast } = useToast();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const canManage = role === 'admin' || role === 'coordinator';

  const fetchCompetitions = async () => {
    try {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .order('competition_date', { ascending: false });

      if (error) throw error;

      // Fetch competition prizes for completed competitions
      const completedIds = (data || []).filter(c => c.is_completed).map(c => c.id);
      let prizesMap: Record<string, CompetitionPrize[]> = {};
      
      if (completedIds.length > 0) {
        const { data: prizesData } = await supabase
          .from('competition_prizes')
          .select('id, competition_id, prize, student_id')
          .in('competition_id', completedIds);

        if (prizesData) {
          const studentIds = prizesData.map(p => p.student_id);
          const { data: studentsData } = await supabase
            .from('students')
            .select('id, name, class, section')
            .in('id', studentIds);

          const studentsMap = (studentsData || []).reduce((acc, s) => {
            acc[s.id] = s;
            return acc;
          }, {} as Record<string, any>);

          prizesData.forEach(p => {
            if (!prizesMap[p.competition_id]) prizesMap[p.competition_id] = [];
            prizesMap[p.competition_id].push({
              id: p.id,
              prize: p.prize,
              student: studentsMap[p.student_id] || null,
            });
          });
        }
      }

      setCompetitions((data || []).map(c => ({ ...c, prizes: prizesMap[c.id] || [] })));
    } catch (error) {
      console.error('Error fetching competitions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load competitions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const { error } = await supabase.from('competitions').insert({
        name: newCompetition.name,
        competition_date: newCompetition.competition_date,
        venue: newCompetition.venue,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Competition created successfully',
      });

      setIsDialogOpen(false);
      setNewCompetition({ name: '', competition_date: '', venue: '' });
      fetchCompetitions();
    } catch (error: any) {
      console.error('Error creating competition:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create competition',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCompetition = async (competitionId: string) => {
    try {
      const { error } = await supabase.from('competitions').delete().eq('id', competitionId);
      if (error) throw error;
      toast({ title: 'Competition deleted successfully' });
      fetchCompetitions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const formatPrize = (prize: string) => {
    const labels: Record<string, string> = {
      winner: 'Winner',
      runner_up_1: 'Runner Up 1',
      runner_up_2: 'Runner Up 2',
    };
    return labels[prize] || prize;
  };

  return (
    <DashboardLayout title="Competitions">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Manage competitions and their events
          </p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Competition
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Competition</DialogTitle>
                <DialogDescription>
                  Add a new external competition
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Competition Name</Label>
                    <Input
                      id="name"
                      value={newCompetition.name}
                      onChange={(e) => setNewCompetition({ ...newCompetition, name: e.target.value })}
                      placeholder="Enter competition name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Competition Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newCompetition.competition_date}
                      onChange={(e) => setNewCompetition({ ...newCompetition, competition_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue">Venue</Label>
                    <Input
                      id="venue"
                      value={newCompetition.venue}
                      onChange={(e) => setNewCompetition({ ...newCompetition, venue: e.target.value })}
                      placeholder="Enter venue"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Competition'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Competitions</CardTitle>
            <CardDescription>View and manage all competitions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : competitions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No competitions found. Create your first competition to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prize Winners</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitions.map((competition) => (
                    <TableRow key={competition.id}>
                      <TableCell className="font-medium">{competition.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(competition.competition_date).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {competition.venue}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={competition.is_completed ? 'secondary' : 'default'}>
                          {competition.is_completed ? 'Completed' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {competition.is_completed && competition.prizes && competition.prizes.length > 0 ? (
                          <div className="space-y-1">
                            {competition.prizes.sort((a, b) => {
                              const order = { winner: 1, runner_up_1: 2, runner_up_2: 3 };
                              return (order[a.prize as keyof typeof order] || 99) - (order[b.prize as keyof typeof order] || 99);
                            }).map((p) => (
                              <div key={p.id} className="flex items-center gap-2 text-sm">
                                <Trophy className="h-3 w-3 text-amber-500" />
                                <span className="font-medium">{formatPrize(p.prize)}:</span>
                                <span>{p.student?.name || 'N/A'}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/coordinator/events?competition=${competition.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Manage Events
                          </Button>
                          {canManage && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Competition?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete "{competition.name}" and all its events, participations, and prizes.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCompetition(competition.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
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

export default CompetitionsPage;
