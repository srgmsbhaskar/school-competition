import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Trophy, Settings, CalendarDays, ChevronRight, Loader2, Layers3, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { forceAcademicYear } from '@/lib/academicYear';
import { useToast } from '@/hooks/use-toast';

type Department = 'external' | 'internal' | 'sports' | 'other';

interface DepartmentIncharge {
  id: string;
  name: string;
  email: string;
  department: Department;
}

interface CompetitionTree {
  id: string;
  name: string;
  department: Department;
  events: EventTree[];
}

interface EventTree {
  id: string;
  name: string;
  classes: number[];
}

const departmentLabels: Record<Department, string> = {
  external: 'External Competition',
  internal: 'Internal Competition',
  sports: 'Sports',
  other: 'Other Competition',
};

const departmentOrder: Department[] = ['external', 'internal', 'sports', 'other'];

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { academicYear } = useAuth();
  const { toast } = useToast();
  const [incharges, setIncharges] = useState<DepartmentIncharge[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionTree[]>([]);
  const [expandedIncharges, setExpandedIncharges] = useState<Record<string, boolean>>({});
  const [expandedCompetitions, setExpandedCompetitions] = useState<Record<string, boolean>>({});
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      setIsLoadingOverview(true);

      try {
        const [profilesRes, rolesRes, assignmentsRes, competitionsRes, eventsRes, classesRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, email'),
          supabase.from('user_roles').select('user_id, role').eq('role', 'department_incharge'),
          supabase.from('department_assignments').select('user_id, department'),
          forceAcademicYear(
            supabase.from('competitions').select('id, name, department'),
            academicYear,
            'competition_date',
          ),
          supabase.from('events').select('id, name, competition_id'),
          supabase.from('event_classes').select('event_id, class'),
        ]);

        const firstError = [profilesRes, rolesRes, assignmentsRes, competitionsRes, eventsRes, classesRes]
          .find((result) => result.error)?.error;
        if (firstError) throw firstError;

        const profilesById = new Map((profilesRes.data || []).map((profile) => [profile.id, profile]));
        const departmentByUserId = new Map(
          (assignmentsRes.data || []).map((assignment) => [assignment.user_id, assignment.department as Department]),
        );

        const loadedIncharges = (rolesRes.data || [])
          .map((role) => {
            const profile = profilesById.get(role.user_id);
            const department = departmentByUserId.get(role.user_id);
            if (!profile || !department) return null;
            return {
              id: profile.id,
              name: profile.full_name,
              email: profile.email,
              department,
            };
          })
          .filter((incharge): incharge is DepartmentIncharge => incharge !== null)
          .sort((a, b) => a.name.localeCompare(b.name));

        const classesByEventId = new Map<string, number[]>();
        (classesRes.data || []).forEach((eventClass) => {
          const classes = classesByEventId.get(eventClass.event_id) || [];
          classes.push(eventClass.class);
          classesByEventId.set(eventClass.event_id, classes);
        });

        const eventsByCompetitionId = new Map<string, EventTree[]>();
        (eventsRes.data || []).forEach((event) => {
          const events = eventsByCompetitionId.get(event.competition_id) || [];
          events.push({
            id: event.id,
            name: event.name,
            classes: (classesByEventId.get(event.id) || []).sort((a, b) => a - b),
          });
          eventsByCompetitionId.set(event.competition_id, events);
        });

        const loadedCompetitions = (competitionsRes.data || [])
          .map((competition) => ({
            id: competition.id,
            name: competition.name,
            department: competition.department as Department,
            events: (eventsByCompetitionId.get(competition.id) || []).sort((a, b) => a.name.localeCompare(b.name)),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setIncharges(loadedIncharges);
        setCompetitions(loadedCompetitions);
      } catch (error) {
        console.error('Error loading admin competition overview:', error);
        toast({ title: 'Error', description: 'Failed to load the current-year competition overview', variant: 'destructive' });
      } finally {
        setIsLoadingOverview(false);
      }
    };

    fetchOverview();
  }, [academicYear, toast]);

  const competitionsByDepartment = useMemo(() => {
    const grouped = new Map<Department, CompetitionTree[]>();
    competitions.forEach((competition) => {
      const current = grouped.get(competition.department) || [];
      current.push(competition);
      grouped.set(competition.department, current);
    });
    return grouped;
  }, [competitions]);

  const toggleExpanded = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, id: string) => {
    setter((current) => ({ ...current, [id]: !current[id] }));
  };

  const stats = [
    {
      title: 'Total Users',
      value: '—',
      description: 'Coordinators & Teachers',
      icon: UserPlus,
      path: '/admin/users',
    },
    {
      title: 'Total Students',
      value: '—',
      description: 'All classes',
      icon: Users,
      path: '/admin/students',
    },
    {
      title: 'Competitions',
      value: '—',
      description: 'Active competitions',
      icon: Trophy,
      path: '/admin/students',
    },
  ];

  const quickActions = [
    {
      title: 'Create User',
      description: 'Add new coordinator or teacher',
      icon: UserPlus,
      path: '/admin/users',
    },
    {
      title: 'Upload Students',
      description: 'Import student data for new year',
      icon: Users,
      path: '/admin/upload',
    },
    {
      title: 'System Settings',
      description: 'Configure system preferences',
      icon: Settings,
      path: '/admin/settings',
    },
  ];

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="space-y-6 animate-fade-in">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Card 
              key={stat.title} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(stat.path)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="section-header">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {quickActions.map((action) => (
              <Card
                key={action.title}
                className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                onClick={() => navigate(action.path)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <action.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{action.title}</CardTitle>
                      <CardDescription>{action.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader className="border-b border-border">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Current Year Competition Overview</CardTitle>
                <CardDescription>Expand an in-charge, competition, and event to view its classes.</CardDescription>
              </div>
              <Badge variant="secondary">Academic year {academicYear}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingOverview ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading current-year overview...
              </div>
            ) : incharges.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No department in-charges are assigned.</div>
            ) : (
              <div className="divide-y divide-border">
                {departmentOrder.map((department) => {
                  const departmentIncharges = incharges.filter((incharge) => incharge.department === department);
                  if (departmentIncharges.length === 0) return null;

                  const departmentCompetitions = competitionsByDepartment.get(department) || [];
                  return (
                    <section key={department} className="p-4 sm:p-5">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        {departmentLabels[department]}
                      </div>
                      <div className="space-y-2">
                        {departmentIncharges.map((incharge) => {
                          const inchargeKey = `${incharge.id}-${department}`;
                          const isInchargeExpanded = expandedIncharges[inchargeKey] === true;
                          return (
                            <div key={inchargeKey} className="rounded-md border border-border bg-muted/20">
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-auto w-full justify-start gap-3 rounded-md px-3 py-3 text-left hover:bg-muted/50"
                                onClick={() => toggleExpanded(setExpandedIncharges, inchargeKey)}
                                aria-expanded={isInchargeExpanded}
                              >
                                <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isInchargeExpanded ? 'rotate-90' : ''}`} />
                                <UserRound className="h-4 w-4 shrink-0 text-primary" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium text-foreground">{incharge.name}</span>
                                  <span className="block truncate text-xs font-normal text-muted-foreground">{incharge.email}</span>
                                </span>
                                <Badge variant="outline" className="shrink-0">
                                  {departmentCompetitions.length} {departmentCompetitions.length === 1 ? 'competition' : 'competitions'}
                                </Badge>
                              </Button>

                              {isInchargeExpanded && (
                                <div className="border-t border-border px-3 pb-3 pt-2 sm:ml-9 sm:pl-0">
                                  {departmentCompetitions.length === 0 ? (
                                    <p className="py-2 text-sm text-muted-foreground">No competitions for this academic year.</p>
                                  ) : (
                                    <div className="space-y-1">
                                      {departmentCompetitions.map((competition) => {
                                        const isCompetitionExpanded = expandedCompetitions[competition.id] === true;
                                        return (
                                          <div key={competition.id}>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              className="h-auto w-full justify-start gap-2 px-2 py-2 text-left hover:bg-muted/50"
                                              onClick={() => toggleExpanded(setExpandedCompetitions, competition.id)}
                                              aria-expanded={isCompetitionExpanded}
                                            >
                                              <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isCompetitionExpanded ? 'rotate-90' : ''}`} />
                                              <Trophy className="h-4 w-4 shrink-0 text-primary" />
                                              <span className="min-w-0 flex-1 truncate font-medium">{competition.name}</span>
                                              <span className="shrink-0 text-xs text-muted-foreground">
                                                {competition.events.length} {competition.events.length === 1 ? 'event' : 'events'}
                                              </span>
                                            </Button>

                                            {isCompetitionExpanded && (
                                              <div className="ml-8 border-l border-border pl-3">
                                                {competition.events.length === 0 ? (
                                                  <p className="py-2 text-sm text-muted-foreground">No events added.</p>
                                                ) : (
                                                  competition.events.map((event) => {
                                                    const isEventExpanded = expandedEvents[event.id] === true;
                                                    return (
                                                      <div key={event.id}>
                                                        <Button
                                                          type="button"
                                                          variant="ghost"
                                                          className="h-auto w-full justify-start gap-2 px-2 py-2 text-left hover:bg-muted/50"
                                                          onClick={() => toggleExpanded(setExpandedEvents, event.id)}
                                                          aria-expanded={isEventExpanded}
                                                        >
                                                          <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isEventExpanded ? 'rotate-90' : ''}`} />
                                                          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                          <span className="min-w-0 flex-1 truncate">{event.name}</span>
                                                          <span className="shrink-0 text-xs text-muted-foreground">
                                                            {event.classes.length} {event.classes.length === 1 ? 'class' : 'classes'}
                                                          </span>
                                                        </Button>

                                                        {isEventExpanded && (
                                                          <div className="ml-8 flex items-start gap-2 border-l border-border px-2 py-2 pl-3 text-sm text-muted-foreground">
                                                            <Layers3 className="mt-0.5 h-4 w-4 shrink-0" />
                                                            {event.classes.length > 0 ? (
                                                              <span>Classes: {event.classes.join(', ')}</span>
                                                            ) : (
                                                              <span>No classes assigned.</span>
                                                            )}
                                                          </div>
                                                        )}
                                                      </div>
                                                    );
                                                  })
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
