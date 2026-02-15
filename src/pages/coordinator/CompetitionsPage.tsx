import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Eye, Calendar, MapPin, Trash2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useDepartment } from '@/hooks/useDepartment';

interface Competition {
  id: string;
  name: string;
  competition_date: string;
  venue: string;
  is_completed: boolean;
  created_at: string;
  prize?: string;
}

const competitionGradeOptions = [
  { value: 'none', label: 'None' },
  { value: 'champion', label: 'Overall Champion' },
  { value: 'runner_up_1', label: '1st Runner Up' },
  { value: 'runner_up_2', label: '2nd Runner Up' },
];

const CompetitionsPage: React.FC = () => {
  const { department, departmentLabel } = useDepartment();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedGrades, setEditedGrades] = useState<Record<string, string>>({});
  const [editedStatuses, setEditedStatuses] = useState<Record<string, string>>({});
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
        .eq('department', department)
        .order('competition_date', { ascending: false });

      if (error) throw error;

      const competitionIds = (data || []).map(c => c.id);
      let prizesMap: Record<string, string> = {};

      if (competitionIds.length > 0) {
        const { data: prizesData } = await supabase
          .from('competition_prizes')
          .select('competition_id, prize')
          .in('competition_id', competitionIds);

        if (prizesData) {
          const order: Record<string, number> = { champion: 1, runner_up_1: 2, runner_up_2: 3 };
          prizesData.forEach(p => {
            const existing = prizesMap[p.competition_id];
            if (!existing || (order[p.prize] || 99) < (order[existing] || 99)) {
              prizesMap[p.competition_id] = p.prize;
            }
          });
        }
      }

      setCompetitions((data || []).map(c => ({ ...c, prize: prizesMap[c.id] || '' })));
    } catch (error) {
      console.error('Error fetching competitions:', error);
      toast({ title: 'Error', description: 'Failed to load competitions', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchCompetitions();
  }, [department]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const { error } = await supabase.from('competitions').insert({
        name: newCompetition.name,
        competition_date: newCompetition.competition_date,
        venue: newCompetition.venue,
        created_by: user?.id,
        department: department,
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Competition created successfully' });
      setIsDialogOpen(false);
      setNewCompetition({ name: '', competition_date: '', venue: '' });
      fetchCompetitions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create competition', variant: 'destructive' });
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

  const handleGradeChange = (competitionId: string, grade: string) => {
    setEditedGrades(prev => ({ ...prev, [competitionId]: grade }));
  };

  const handleSave = async () => {
    if (Object.keys(editedGrades).length === 0 && Object.keys(editedStatuses).length === 0) return;

    setIsSaving(true);
    try {
      for (const [competitionId, grade] of Object.entries(editedGrades)) {
        await supabase
          .from('competition_prizes')
          .delete()
          .eq('competition_id', competitionId)
          .in('prize', ['champion', 'runner_up_1', 'runner_up_2']);

        if (grade && grade !== 'none') {
          const { data: anyStudent } = await supabase
            .from('students')
            .select('id')
            .limit(1)
            .single();

          if (anyStudent) {
            await supabase.from('competition_prizes').insert({
              competition_id: competitionId,
              student_id: anyStudent.id,
              prize: grade,
              awarded_by: user?.id,
            });
          }
        }
      }

      for (const [competitionId, status] of Object.entries(editedStatuses)) {
        await supabase
          .from('competitions')
          .update({ is_completed: status === 'completed' })
          .eq('id', competitionId);
      }

      toast({ title: 'Success', description: 'Changes saved successfully' });
      setEditedGrades({});
      setEditedStatuses({});
      fetchCompetitions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const getGradeLabel = (prize: string) => {
    return competitionGradeOptions.find(o => o.value === prize)?.label || '';
  };

  const getGradeValue = (competition: Competition) => {
    return editedGrades[competition.id] ?? competition.prize ?? '';
  };

  return (
    <DashboardLayout title={`${departmentLabel} - Competitions`}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Manage {departmentLabel.toLowerCase()} competitions and their events
          </p>
          <div className="flex items-center gap-2">
            {(Object.keys(editedGrades).length > 0 || Object.keys(editedStatuses).length > 0) && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" />Save Changes</>
                )}
              </Button>
            )}
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
                  <DialogDescription>Add a new {departmentLabel.toLowerCase()} competition</DialogDescription>
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
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>) : 'Create Competition'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Competitions</CardTitle>
            <CardDescription>View and manage all {departmentLabel.toLowerCase()} competitions</CardDescription>
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
                    <TableHead>Prize</TableHead>
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
                        {canManage ? (
                          <Select
                            value={editedStatuses[competition.id] ?? (competition.is_completed ? 'completed' : 'active')}
                            onValueChange={(value) => setEditedStatuses(prev => ({ ...prev, [competition.id]: value }))}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={competition.is_completed ? 'secondary' : 'default'}>
                            {competition.is_completed ? 'Completed' : 'Active'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          <Select
                            value={getGradeValue(competition)}
                            onValueChange={(value) => handleGradeChange(competition.id, value)}
                          >
                            <SelectTrigger className="w-44">
                              <SelectValue placeholder="Select grade" />
                            </SelectTrigger>
                            <SelectContent>
                              {competitionGradeOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          competition.prize ? (
                            <Badge variant="outline">{getGradeLabel(competition.prize)}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/coordinator/${department}/events?competition=${competition.id}`)}
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
