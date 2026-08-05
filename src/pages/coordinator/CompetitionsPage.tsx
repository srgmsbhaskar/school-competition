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
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Plus, Loader2, Eye, Calendar, MapPin, Trash2, Save, Snowflake, Unlock, Trophy, Pencil } from 'lucide-react';
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
  is_frozen: boolean;
  created_at: string;
  prize?: string;
  overall_status?: string | null;
}

export const overallStatusOptions = [
  { value: 'overall_winner', label: 'Overall Winner' },
  { value: 'runner_up_1', label: '1st Runner Up' },
  { value: 'runner_up_2', label: '2nd Runner Up' },
  { value: 'rotational_shield', label: 'Rotational Shield' },
];

export const getOverallStatusLabel = (value?: string | null) =>
  overallStatusOptions.find((o) => o.value === value)?.label || '';

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
  const [editCompetition, setEditCompetition] = useState<Competition | null>(null);
  const [editForm, setEditForm] = useState({ name: '', competition_date: '', venue: '' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [editedGrades, setEditedGrades] = useState<Record<string, string>>({});
  const [editedStatuses, setEditedStatuses] = useState<Record<string, string>>({});
  const [newCompetition, setNewCompetition] = useState({
    name: '',
    competition_date: '',
    venue: '',
  });
  const { toast } = useToast();
  const { user, role, academicYear } = useAuth();
  const navigate = useNavigate();
  const canManage = role === 'admin' || role === 'coordinator' || role === 'department_incharge';
  const canFreeze = role === 'admin' || role === 'coordinator';

  // Compute academic year date range (April 1 to March 31)
  const getAcademicYearRange = () => {
    const [startYear] = academicYear.split('-').map(Number);
    return {
      start: `${startYear}-04-01`,
      end: `${startYear + 1}-03-31`,
    };
  };

  const fetchCompetitions = async () => {
    try {
      const { start, end } = getAcademicYearRange();
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('department', department)
        .gte('competition_date', start)
        .lte('competition_date', end)
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

  const openEdit = (competition: Competition) => {
    setEditCompetition(competition);
    setEditForm({
      name: competition.name,
      competition_date: competition.competition_date,
      venue: competition.venue,
    });
  };

  const handleUpdateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCompetition) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('competitions')
        .update({
          name: editForm.name,
          competition_date: editForm.competition_date,
          venue: editForm.venue,
        })
        .eq('id', editCompetition.id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Competition updated' });
      setEditCompetition(null);
      fetchCompetitions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update competition', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
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

  const handleToggleFreeze = async (competitionId: string, currentlyFrozen: boolean) => {
    try {
      const { error } = await supabase
        .from('competitions')
        .update({ is_frozen: !currentlyFrozen })
        .eq('id', competitionId);
      if (error) throw error;
      toast({ title: currentlyFrozen ? 'Competition Unfrozen' : 'Competition Frozen', description: currentlyFrozen ? 'Dept in-charges and teachers can now edit this competition.' : 'Dept in-charges and teachers can no longer edit this competition.' });
      fetchCompetitions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getGradeLabel = (prize: string) => {
    return competitionGradeOptions.find(o => o.value === prize)?.label || '';
  };

  const getGradeValue = (competition: Competition) => {
    return editedGrades[competition.id] ?? competition.prize ?? '';
  };

  const handleSetOverallStatus = async (competitionId: string, status: string | null) => {
    try {
      const { error } = await supabase
        .from('competitions')
        .update({ overall_status: status })
        .eq('id', competitionId);
      if (error) throw error;
      setCompetitions((prev) => prev.map((c) => (c.id === competitionId ? { ...c, overall_status: status } : c)));
      toast({ title: status ? 'Status updated' : 'Status cleared', description: status ? getOverallStatusLabel(status) : undefined });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const StatusContextMenu: React.FC<{ competition: Competition; children: React.ReactNode }> = ({ competition, children }) => (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {canManage && (
          <>
            <ContextMenuItem onSelect={() => openEdit(competition)}>Edit competition</ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuLabel>Set Status</ContextMenuLabel>
        <ContextMenuSeparator />
        {overallStatusOptions.map((opt) => (
          <ContextMenuItem key={opt.value} onSelect={() => handleSetOverallStatus(competition.id, opt.value)}>
            {opt.label}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => handleSetOverallStatus(competition.id, null)}>Clear status</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );

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

        {/* Dept in-charge: Competition cards view */}
        {role === 'department_incharge' ? (
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : competitions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No competitions found. Create your first competition to get started.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {competitions.map((competition, index) => {
                  const colorPalette = [
                    { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-700', icon: 'text-blue-600' },
                    { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-700', icon: 'text-emerald-600' },
                    { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-700', icon: 'text-purple-600' },
                    { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-700', icon: 'text-orange-600' },
                    { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-700', icon: 'text-rose-600' },
                    { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-700', icon: 'text-cyan-600' },
                    { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-700', icon: 'text-amber-600' },
                    { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-700', icon: 'text-indigo-600' },
                  ];
                  const color = colorPalette[index % colorPalette.length];
                  return (
                    <StatusContextMenu key={competition.id} competition={competition}>
                    <Card
                      className={`cursor-pointer hover:shadow-lg transition-all border-2 ${color.border} ${competition.is_frozen ? 'opacity-60' : ''}`}
                      onClick={() => navigate(`/coordinator/${department}/events?competition=${competition.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color.bg} flex-shrink-0`}>
                            <Trophy className={`h-5 w-5 ${color.icon}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-semibold text-sm truncate ${color.text}`}>{competition.name}</h3>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(competition.competition_date).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{competition.venue}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-2">
                              <Badge variant={competition.is_completed ? 'secondary' : 'default'} className="text-xs">
                                {competition.is_completed ? 'Completed' : 'Active'}
                              </Badge>
                              {competition.is_frozen && (
                                <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                                  <Snowflake className="mr-1 h-3 w-3" />Frozen
                                </Badge>
                              )}
                            </div>
                            {competition.overall_status && (
                              <Badge className="mt-2 text-xs" variant="outline">
                                <Trophy className="mr-1 h-3 w-3" />{getOverallStatusLabel(competition.overall_status)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    </StatusContextMenu>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
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
                      <StatusContextMenu key={competition.id} competition={competition}>
                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {competition.name}
                            {competition.overall_status && (
                              <Badge variant="outline"><Trophy className="mr-1 h-3 w-3" />{getOverallStatusLabel(competition.overall_status)}</Badge>
                            )}
                          </div>
                        </TableCell>
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
                            {canFreeze && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleFreeze(competition.id, competition.is_frozen)}
                                title={competition.is_frozen ? 'Unfreeze competition' : 'Freeze competition'}
                              >
                                {competition.is_frozen ? (
                                  <><Unlock className="mr-1 h-4 w-4 text-emerald-600" />Unfreeze</>
                                ) : (
                                  <><Snowflake className="mr-1 h-4 w-4 text-blue-600" />Freeze</>
                                )}
                              </Button>
                            )}
                            {!canFreeze && competition.is_frozen && (
                              <Badge variant="outline" className="text-orange-600 border-orange-300">
                                <Snowflake className="mr-1 h-3 w-3" />Frozen
                              </Badge>
                            )}
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
                            {canManage && (
                              <Button variant="ghost" size="sm" onClick={() => openEdit(competition)} title="Edit competition">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      </StatusContextMenu>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CompetitionsPage;
