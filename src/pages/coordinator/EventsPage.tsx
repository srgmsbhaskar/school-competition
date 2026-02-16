import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDepartment } from '@/hooks/useDepartment';

interface Competition {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Event {
  id: string;
  name: string;
  competition_id: string;
  category_id: string | null;
  event_type: 'solo' | 'group';
  category?: Category;
  classes: number[];
}

const EventsPage: React.FC = () => {
  const { department, departmentLabel } = useDepartment();
  const [searchParams] = useSearchParams();
  const competitionId = searchParams.get('competition');
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>(competitionId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: '',
    category_id: '',
    event_type: 'solo' as 'solo' | 'group',
    classes: [] as number[],
  });
  const { toast } = useToast();
  const { role } = useAuth();
  const canManage = role === 'admin' || role === 'coordinator' || role === 'department_incharge';
  const allClasses = Array.from({ length: 12 }, (_, i) => i + 1);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [competitionsRes, categoriesRes] = await Promise.all([
        supabase.from('competitions').select('id, name').eq('department', department).order('competition_date', { ascending: false }),
        supabase.from('categories').select('*'),
      ]);

      setCompetitions(competitionsRes.data || []);
      setCategories(categoriesRes.data || []);

      if (selectedCompetition) {
        const { data: eventsData } = await supabase
          .from('events')
          .select('*, category:categories(*)')
          .eq('competition_id', selectedCompetition);

        const { data: eventClassesData } = await supabase
          .from('event_classes')
          .select('*');

        const eventsWithClasses = (eventsData || []).map((event) => ({
          ...event,
          classes: (eventClassesData || [])
            .filter((ec) => ec.event_id === event.id)
            .map((ec) => ec.class),
        }));

        setEvents(eventsWithClasses);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCompetition, department]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompetition) {
      toast({ title: 'Error', description: 'Please select a competition first', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          name: newEvent.name,
          competition_id: selectedCompetition,
          category_id: newEvent.category_id || null,
          event_type: newEvent.event_type,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      if (newEvent.classes.length > 0) {
        const eventClasses = newEvent.classes.map((c) => ({
          event_id: eventData.id,
          class: c,
        }));
        const { error: classesError } = await supabase.from('event_classes').insert(eventClasses);
        if (classesError) throw classesError;
      }

      toast({ title: 'Success', description: 'Event created successfully' });
      setIsDialogOpen(false);
      setNewEvent({ name: '', category_id: '', event_type: 'solo', classes: [] });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create event', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClassToggle = (classNum: number) => {
    setNewEvent((prev) => ({
      ...prev,
      classes: prev.classes.includes(classNum)
        ? prev.classes.filter((c) => c !== classNum)
        : [...prev.classes, classNum],
    }));
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) throw error;
      toast({ title: 'Event deleted' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout title={`${departmentLabel} - Events`}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="w-64">
            <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
              <SelectTrigger>
                <SelectValue placeholder="Select competition" />
              </SelectTrigger>
              <SelectContent>
                {competitions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedCompetition && events.length < 30 && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add Event</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Event</DialogTitle>
                  <DialogDescription>Create a new event for this competition (max 30 events)</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="eventName">Event Name</Label>
                      <Input id="eventName" value={newEvent.name} onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })} placeholder="Enter event name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eventType">Event Type</Label>
                      <Select value={newEvent.event_type} onValueChange={(value: 'solo' | 'group') => setNewEvent({ ...newEvent, event_type: value })}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solo">Solo</SelectItem>
                          <SelectItem value="group">Group</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select value={newEvent.category_id} onValueChange={(value) => setNewEvent({ ...newEvent, category_id: value })}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Eligible Classes</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {allClasses.map((c) => (
                          <div key={c} className="flex items-center space-x-2">
                            <Checkbox id={`class-${c}`} checked={newEvent.classes.includes(c)} onCheckedChange={() => handleClassToggle(c)} />
                            <Label htmlFor={`class-${c}`} className="text-sm">Class {c}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>) : 'Create Event'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Events {events.length > 0 && `(${events.length}/30)`}</CardTitle>
            <CardDescription>{selectedCompetition ? 'Events for this competition' : 'Select a competition to view events'}</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedCompetition ? (
              <div className="text-center py-8 text-muted-foreground">Please select a competition to view and manage events</div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No events found. Add your first event.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Eligible Classes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.name}</TableCell>
                      <TableCell>
                        <Badge variant={event.event_type === 'solo' ? 'default' : 'secondary'}>
                          {event.event_type === 'solo' ? 'Solo' : 'Group'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {event.category?.name ? (<Badge variant="outline">{event.category.name}</Badge>) : (<span className="text-muted-foreground">—</span>)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {event.classes.length > 0 ? (
                            event.classes.sort((a, b) => a - b).map((c) => (
                              <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground">All classes</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete "{event.name}" and all associated participations.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteEvent(event.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
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

export default EventsPage;
