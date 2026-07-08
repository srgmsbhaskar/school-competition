import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Pencil, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Student {
  id: string;
  s_no: number;
  admission_no: string;
  name: string;
  dob: string;
  class: number;
  section: string;
  academic_year: string;
}

// Cap student listing at 3000 rows per academic year (3 batches of 1000).
const ROW_CAP = 3000;
const PAGE_SIZE = 1000;

const StudentDatabase: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [allSections, setAllSections] = useState<string[]>([]);
  const [allClasses, setAllClasses] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ name: '', admission_no: '', dob: '', section: '', s_no: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const emptyAddForm = { name: '', admission_no: '', dob: '', class: '', section: '', s_no: '', academic_year: '' };
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  /** Paginate through Supabase's 1000-row limit up to ROW_CAP. */
  const fetchPaginated = async <T,>(
    build: (from: number, to: number) => any,
  ): Promise<{ rows: T[]; truncated: boolean }> => {
    const all: T[] = [];
    for (let from = 0; from < ROW_CAP; from += PAGE_SIZE) {
      const to = Math.min(from + PAGE_SIZE - 1, ROW_CAP - 1);
      const { data, error } = await build(from, to);
      if (error) throw error;
      const batch = (data || []) as T[];
      all.push(...batch);
      if (batch.length < to - from + 1) return { rows: all, truncated: false };
    }
    return { rows: all, truncated: all.length >= ROW_CAP };
  };

  // Fetch distinct sections and classes from DB
  const fetchFilterOptions = async () => {
    try {
      const { rows } = await fetchPaginated<{ class: number; section: string }>((from, to) =>
        supabase.from('students').select('class, section').range(from, to),
      );
      setAllClasses([...new Set(rows.map((s) => s.class))].sort((a, b) => a - b));
      setAllSections([...new Set(rows.map((s) => s.section))].sort());
    } catch {}
  };

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const { rows, truncated: wasTruncated } = await fetchPaginated<Student>((from, to) => {
        let q = supabase
          .from('students')
          .select('*')
          .order('class')
          .order('section')
          .order('s_no')
          .range(from, to);
        if (selectedClass !== 'all') q = q.eq('class', parseInt(selectedClass));
        if (selectedSection !== 'all') q = q.eq('section', selectedSection);
        if (selectedYear !== 'all') q = q.eq('academic_year', selectedYear);
        return q;
      });
      setStudents(rows);
      setTruncated(wasTruncated);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({ title: 'Error', description: 'Failed to load students', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [selectedClass, selectedSection, selectedYear]);

  const filteredStudents = students.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.admission_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sections = allSections;
  const classes = allClasses;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear - 2 + i;
    return `${y}-${y + 1}`;
  });

  const defaultAcademicYear = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const startYear = now.getMonth() >= 3 ? y : y - 1;
    return `${startYear}-${startYear + 1}`;
  })();

  const handleAddOpen = () => {
    setAddForm({
      ...emptyAddForm,
      academic_year: selectedYear !== 'all' ? selectedYear : defaultAcademicYear,
      class: selectedClass !== 'all' ? selectedClass : '',
      section: selectedSection !== 'all' ? selectedSection : '',
    });
    setIsAddOpen(true);
  };

  const handleAddSave = async () => {
    if (!addForm.name.trim() || !addForm.admission_no.trim() || !addForm.dob || !addForm.class || !addForm.section.trim() || !addForm.s_no || !addForm.academic_year) {
      toast({ title: 'Missing fields', description: 'All fields are required', variant: 'destructive' });
      return;
    }
    const classNum = parseInt(addForm.class);
    if (isNaN(classNum) || classNum < 1 || classNum > 12) {
      toast({ title: 'Invalid class', description: 'Class must be between 1 and 12', variant: 'destructive' });
      return;
    }
    setIsAdding(true);
    try {
      const { error } = await supabase.from('students').insert({
        name: addForm.name.trim(),
        admission_no: addForm.admission_no.trim(),
        dob: addForm.dob,
        class: classNum,
        section: addForm.section.trim().toUpperCase(),
        s_no: parseInt(addForm.s_no),
        academic_year: addForm.academic_year,
      });
      if (error) throw error;
      toast({ title: 'Success', description: 'Student added successfully' });
      setIsAddOpen(false);
      fetchFilterOptions();
      fetchStudents();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to add student', variant: 'destructive' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditOpen = (student: Student) => {
    setEditStudent(student);
    setEditForm({
      name: student.name,
      admission_no: student.admission_no,
      dob: student.dob,
      section: student.section,
      s_no: student.s_no,
    });
  };

  const handleEditSave = async () => {
    if (!editStudent) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: editForm.name,
          admission_no: editForm.admission_no,
          dob: editForm.dob,
          section: editForm.section,
          s_no: editForm.s_no,
        })
        .eq('id', editStudent.id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Student updated successfully' });
      setEditStudent(null);
      fetchStudents();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update student', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClassWise = async () => {
    if (selectedClass === 'all') {
      toast({ title: 'Error', description: 'Please select a specific class to delete', variant: 'destructive' });
      return;
    }
    setIsDeleting(true);
    try {
      let query = supabase.from('students').delete().eq('class', parseInt(selectedClass));
      if (selectedYear !== 'all') {
        query = query.eq('academic_year', selectedYear);
      }
      const { error } = await query;
      if (error) throw error;
      toast({ title: 'Deleted', description: `Students of Class ${selectedClass}${selectedYear !== 'all' ? ` (${selectedYear})` : ''} deleted successfully` });
      fetchStudents();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete students', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout title="Student Database">
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter students by class, section, and academic year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="w-40">
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c} value={c.toString()}>Class {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {sections.map((s) => (
                      <SelectItem key={s} value={s}>Section {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Academic Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px] max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or admission number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              {selectedClass !== 'all' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isDeleting}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Class {selectedClass}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all students in Class {selectedClass}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all students in Class {selectedClass}
                        {selectedYear !== 'all' ? ` for academic year ${selectedYear}` : ' across all academic years'}.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteClassWise}>
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Students ({filteredStudents.length})</CardTitle>
              <CardDescription>
                {selectedClass === 'all' ? 'All classes' : `Class ${selectedClass}`}
                {selectedSection !== 'all' && ` - Section ${selectedSection}`}
                {selectedYear !== 'all' && ` - ${selectedYear}`}
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleAddOpen}>
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </CardHeader>
          <CardContent>
            {truncated && (
              <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                Showing the first 3000 records. Narrow filters (class / section / year) to see more.
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No students found. Upload student data to get started.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">S.No</TableHead>
                      <TableHead>Admission No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>DOB</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>{student.s_no}</TableCell>
                        <TableCell className="font-mono">{student.admission_no}</TableCell>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{new Date(student.dob).toLocaleDateString()}</TableCell>
                        <TableCell>{student.class}</TableCell>
                        <TableCell>{student.section}</TableCell>
                        <TableCell>{student.academic_year}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleEditOpen(student)} title="Edit student">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Student Dialog */}
      <Dialog open={!!editStudent} onOpenChange={(open) => !open && setEditStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Update student details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Admission No.</Label>
              <Input value={editForm.admission_no} onChange={(e) => setEditForm({ ...editForm, admission_no: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" value={editForm.dob} onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={editForm.section} onValueChange={(v) => setEditForm({ ...editForm, section: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>S.No</Label>
              <Input type="number" value={editForm.s_no} onChange={(e) => setEditForm({ ...editForm, s_no: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStudent(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Student Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>Enter the student's details.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2 col-span-2">
              <Label>Name</Label>
              <Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Admission No.</Label>
              <Input value={addForm.admission_no} onChange={(e) => setAddForm({ ...addForm, admission_no: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>S.No</Label>
              <Input type="number" value={addForm.s_no} onChange={(e) => setAddForm({ ...addForm, s_no: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" value={addForm.dob} onChange={(e) => setAddForm({ ...addForm, dob: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Class (1-12)</Label>
              <Input type="number" min={1} max={12} value={addForm.class} onChange={(e) => setAddForm({ ...addForm, class: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Input value={addForm.section} onChange={(e) => setAddForm({ ...addForm, section: e.target.value })} placeholder="e.g. A" />
            </div>
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <Select value={addForm.academic_year} onValueChange={(v) => setAddForm({ ...addForm, academic_year: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSave} disabled={isAdding}>
              {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default StudentDatabase;
