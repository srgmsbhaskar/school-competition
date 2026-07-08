import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, AlertTriangle, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { 
  parseAndValidateRows, 
  validateFile, 
  MAX_FILE_SIZE,
  type ValidatedStudentRow,
  type ValidationError 
} from '@/lib/csvValidation';

const UploadPage: React.FC = () => {
  // Student upload state
  const [academicYear, setAcademicYear] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [uploadMode, setUploadMode] = useState<'single' | 'all'>('single');
  const [csvData, setCsvData] = useState<ValidatedStudentRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastUploadSummary, setLastUploadSummary] = useState<{ inserted: number; skipped: number } | null>(null);
  
  // Teacher individual state
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [isCreatingTeacher, setIsCreatingTeacher] = useState(false);

  // Teacher bulk state
  const [teacherCsvData, setTeacherCsvData] = useState<Array<{ name: string; email: string; password: string }>>([]);
  const [teacherCsvErrors, setTeacherCsvErrors] = useState<string[]>([]);
  const [isUploadingTeachers, setIsUploadingTeachers] = useState(false);
  const [teacherUploadStatus, setTeacherUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => `${currentYear - 2 + i}-${currentYear - 1 + i}`);
  const classes = Array.from({ length: 12 }, (_, i) => i + 1);

  // ---- Student Upload Logic ----
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
      toast({ title: 'Invalid File', description: fileValidation.error, variant: 'destructive' });
      e.target.value = '';
      return;
    }

    if (uploadMode === 'single' && !selectedClass) {
      toast({ title: 'Select Class First', description: 'Please select a class before uploading the Excel file', variant: 'destructive' });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(firstSheet, {
          header: 1,
          defval: '',
          raw: true,
        });

        const result = parseAndValidateRows(
          rows as (string | number | null)[][],
          uploadMode === 'single' ? parseInt(selectedClass) : null,
        );

        setCsvData(result.validRows);
        setValidationErrors(result.errors);
        setUploadStatus('idle');

        if (result.errors.length > 0) {
          toast({ title: 'Validation Warnings', description: `${result.errors.length} row(s) have validation issues. ${result.validRows.length} valid rows ready for upload.`, variant: 'destructive' });
        } else if (result.validRows.length > 0) {
          toast({ title: 'File Parsed Successfully', description: `${result.validRows.length} students ready for upload` });
        }
      } catch (err) {
        toast({ title: 'Parse Error', description: 'Failed to read the Excel file', variant: 'destructive' });
      }
    };
    reader.onerror = () => {
      toast({ title: 'File Read Error', description: 'Failed to read the Excel file', variant: 'destructive' });
    };
    reader.readAsArrayBuffer(file);
  };

  const handleStudentUpload = async () => {
    if (!academicYear || csvData.length === 0 || (uploadMode === 'single' && !selectedClass)) {
      toast({ title: 'Missing Information', description: 'Please select academic year, class, and upload a valid CSV file', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const allStudents = csvData.map((row) => ({
        s_no: row.s_no,
        admission_no: row.admission_no,
        name: row.name,
        dob: row.dob,
        class: uploadMode === 'single' ? parseInt(selectedClass) : row.class,
        section: row.section,
        academic_year: academicYear,
      }));

      // Check for existing admission numbers in the target academic year to skip duplicates.
      const admissionNos = [...new Set(allStudents.map((s) => s.admission_no))];
      const existing = new Set<string>();
      const CHUNK = 500;
      for (let i = 0; i < admissionNos.length; i += CHUNK) {
        const slice = admissionNos.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from('students')
          .select('admission_no')
          .eq('academic_year', academicYear)
          .in('admission_no', slice);
        if (error) throw error;
        (data || []).forEach((r: { admission_no: string }) => existing.add(r.admission_no));
      }

      const seen = new Set<string>();
      const toInsert = allStudents.filter((s) => {
        if (existing.has(s.admission_no)) return false;
        if (seen.has(s.admission_no)) return false;
        seen.add(s.admission_no);
        return true;
      });
      const skipped = allStudents.length - toInsert.length;

      if (toInsert.length > 0) {
        const { error } = await supabase.from('students').insert(toInsert);
        if (error) throw error;
      }

      setUploadStatus('success');
      setLastUploadSummary({ inserted: toInsert.length, skipped });
      toast({
        title: 'Upload Complete',
        description: `${toInsert.length} added, ${skipped} duplicate(s) skipped`,
      });
      setCsvData([]);
      setValidationErrors([]);
    } catch (error: unknown) {
      setUploadStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload students';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  // ---- Teacher Individual Create ----
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingTeacher(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            email: teacherEmail,
            password: teacherPassword,
            fullName: teacherName,
            role: 'teacher',
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create teacher');

      toast({ title: 'Success', description: `Teacher ${teacherName} created successfully` });
      setTeacherName('');
      setTeacherEmail('');
      setTeacherPassword('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create teacher', variant: 'destructive' });
    } finally {
      setIsCreatingTeacher(false);
    }
  };

  // ---- Teacher Bulk Upload ----
  const handleTeacherFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExts = ['.csv', '.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) {
      toast({ title: 'Invalid File', description: 'Please upload a CSV or Excel file', variant: 'destructive' });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      if (lines.length < 2) {
        toast({ title: 'Empty File', description: 'The file must have a header row and at least one data row', variant: 'destructive' });
        return;
      }

      const errors: string[] = [];
      const teachers: Array<{ name: string; email: string; password: string }> = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 3) {
          errors.push(`Row ${i + 1}: Expected at least 3 columns (Name, Email, Password)`);
          continue;
        }
        const [name, email, password] = cols;
        if (!name || !email || !password) {
          errors.push(`Row ${i + 1}: Missing name, email, or password`);
          continue;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push(`Row ${i + 1}: Invalid email format "${email}"`);
          continue;
        }
        if (password.length < 6) {
          errors.push(`Row ${i + 1}: Password must be at least 6 characters`);
          continue;
        }
        teachers.push({ name, email, password });
      }

      setTeacherCsvData(teachers);
      setTeacherCsvErrors(errors);
      setTeacherUploadStatus('idle');

      if (errors.length > 0) {
        toast({ title: 'Validation Warnings', description: `${errors.length} row(s) have issues. ${teachers.length} valid teachers ready.`, variant: 'destructive' });
      } else if (teachers.length > 0) {
        toast({ title: 'File Parsed', description: `${teachers.length} teachers ready for upload` });
      }
    };
    reader.readAsText(file);
  };

  const handleBulkTeacherUpload = async () => {
    if (teacherCsvData.length === 0) return;
    setIsUploadingTeachers(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let successCount = 0;
      const failedList: string[] = [];

      for (const teacher of teacherCsvData) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionData.session?.access_token}`,
              },
              body: JSON.stringify({
                email: teacher.email,
                password: teacher.password,
                fullName: teacher.name,
                role: 'teacher',
              }),
            }
          );
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          successCount++;
        } catch (err: any) {
          failedList.push(`${teacher.email}: ${err.message}`);
        }
      }

      if (failedList.length > 0) {
        setTeacherUploadStatus('error');
        toast({
          title: `${successCount} created, ${failedList.length} failed`,
          description: failedList.slice(0, 3).join('; '),
          variant: 'destructive',
        });
      } else {
        setTeacherUploadStatus('success');
        toast({ title: 'Success', description: `${successCount} teachers created successfully` });
        setTeacherCsvData([]);
        setTeacherCsvErrors([]);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to upload teachers', variant: 'destructive' });
    } finally {
      setIsUploadingTeachers(false);
    }
  };

  return (
    <DashboardLayout title="Upload">
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="students">
          <TabsList>
            <TabsTrigger value="students">Upload Students</TabsTrigger>
            <TabsTrigger value="teacher-individual">Add Teacher</TabsTrigger>
            <TabsTrigger value="teacher-bulk">Bulk Upload Teachers</TabsTrigger>
          </TabsList>

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Student Data</CardTitle>
                <CardDescription>
                  Upload an Excel file (.xlsx or .xls) with student information for a specific class and academic year.
                  Maximum file size: {MAX_FILE_SIZE / (1024 * 1024)}MB
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Upload Mode</Label>
                  <Select value={uploadMode} onValueChange={(v: 'single' | 'all') => { setUploadMode(v); setCsvData([]); setValidationErrors([]); setLastUploadSummary(null); }}>
                    <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single class (choose class below)</SelectItem>
                      <SelectItem value="all">All classes at once (file must include a "Class" column)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Academic Year</Label>
                    <Select value={academicYear} onValueChange={setAcademicYear}>
                      <SelectTrigger><SelectValue placeholder="Select academic year" /></SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (<SelectItem key={year} value={year}>{year}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2" style={{ opacity: uploadMode === 'all' ? 0.5 : 1 }}>
                    <Label>Class</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass} disabled={uploadMode === 'all'}>
                      <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (<SelectItem key={c} value={c.toString()}>Class {c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Excel File</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                    <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">
                      {uploadMode === 'single'
                        ? 'Upload an Excel file (.xlsx / .xls) with columns: S No, Admission No, Name, DOB, Section'
                        : 'Upload an Excel file (.xlsx / .xls) with columns: S No, Admission No, Name, DOB, Class, Section'}
                      <br />
                      Existing admission numbers in this academic year will be skipped automatically.
                    </p>
                    <Input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="max-w-xs mx-auto" />
                  </div>
                </div>

                {validationErrors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold">Validation Errors ({validationErrors.length})</span>
                    </div>
                    <div className="max-h-40 overflow-auto rounded-md border border-amber-200 bg-amber-50 p-3">
                      <ul className="text-sm text-amber-800 space-y-1">
                        {validationErrors.slice(0, 10).map((err, idx) => (
                          <li key={idx}>Row {err.row}: {err.field} - {err.message}</li>
                        ))}
                        {validationErrors.length > 10 && (
                          <li className="text-amber-600 font-medium">... and {validationErrors.length - 10} more errors</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                {csvData.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Preview ({csvData.length} valid students)</h3>
                      <Button onClick={handleStudentUpload} disabled={isUploading}>
                        {isUploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>) : (<><Upload className="mr-2 h-4 w-4" />Upload Students</>)}
                      </Button>
                    </div>
                    <div className="rounded-md border max-h-96 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>S.No</TableHead>
                            <TableHead>Admission No.</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>DOB</TableHead>
                            <TableHead>Section</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvData.slice(0, 10).map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{row.s_no}</TableCell>
                              <TableCell className="font-mono">{row.admission_no}</TableCell>
                              <TableCell>{row.name}</TableCell>
                              <TableCell>{row.dob}</TableCell>
                              <TableCell>{row.section}</TableCell>
                            </TableRow>
                          ))}
                          {csvData.length > 10 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground">
                                ... and {csvData.length - 10} more students
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {uploadStatus === 'success' && (
                  <div className="flex items-center gap-2 text-success p-4 bg-success/10 rounded-lg">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>
                      {lastUploadSummary
                        ? `Uploaded successfully — ${lastUploadSummary.inserted} added, ${lastUploadSummary.skipped} duplicate(s) skipped.`
                        : 'Students uploaded successfully!'}
                    </span>
                  </div>
                )}
                {uploadStatus === 'error' && (
                  <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-lg">
                    <AlertCircle className="h-5 w-5" />
                    <span>Failed to upload students. Please check the data and try again.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Individual Teacher Tab */}
          <TabsContent value="teacher-individual">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Add Individual Teacher
                </CardTitle>
                <CardDescription>Create a single teacher account</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateTeacher} className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="teacherName">Full Name</Label>
                    <Input id="teacherName" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Enter teacher's full name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teacherEmail">Email</Label>
                    <Input id="teacherEmail" type="email" value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)} placeholder="Enter email address" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teacherPassword">Password</Label>
                    <Input id="teacherPassword" type="password" value={teacherPassword} onChange={(e) => setTeacherPassword(e.target.value)} placeholder="Enter password (min 6 characters)" required minLength={6} />
                  </div>
                  <Button type="submit" disabled={isCreatingTeacher}>
                    {isCreatingTeacher ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>) : (<><UserPlus className="mr-2 h-4 w-4" />Create Teacher</>)}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bulk Teacher Tab */}
          <TabsContent value="teacher-bulk" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Upload Teachers</CardTitle>
                <CardDescription>Upload a CSV file with teacher information. Columns: Name, Email, Password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>CSV File</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                    <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload a CSV file with columns: Name, Email, Password
                    </p>
                    <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleTeacherFileUpload} className="max-w-xs mx-auto" />
                  </div>
                </div>

                {teacherCsvErrors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold">Validation Errors ({teacherCsvErrors.length})</span>
                    </div>
                    <div className="max-h-40 overflow-auto rounded-md border border-amber-200 bg-amber-50 p-3">
                      <ul className="text-sm text-amber-800 space-y-1">
                        {teacherCsvErrors.slice(0, 10).map((err, idx) => (<li key={idx}>{err}</li>))}
                      </ul>
                    </div>
                  </div>
                )}

                {teacherCsvData.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Preview ({teacherCsvData.length} valid teachers)</h3>
                      <Button onClick={handleBulkTeacherUpload} disabled={isUploadingTeachers}>
                        {isUploadingTeachers ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>) : (<><Upload className="mr-2 h-4 w-4" />Upload Teachers</>)}
                      </Button>
                    </div>
                    <div className="rounded-md border max-h-96 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Password</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teacherCsvData.slice(0, 10).map((t, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{t.name}</TableCell>
                              <TableCell>{t.email}</TableCell>
                              <TableCell className="font-mono">{'•'.repeat(t.password.length)}</TableCell>
                            </TableRow>
                          ))}
                          {teacherCsvData.length > 10 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground">
                                ... and {teacherCsvData.length - 10} more teachers
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {teacherUploadStatus === 'success' && (
                  <div className="flex items-center gap-2 text-success p-4 bg-success/10 rounded-lg">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Teachers uploaded successfully!</span>
                  </div>
                )}
                {teacherUploadStatus === 'error' && (
                  <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-lg">
                    <AlertCircle className="h-5 w-5" />
                    <span>Some teachers failed to upload. Check the details above.</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>CSV Format Guide</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-md font-mono text-sm">
                  Name,Email,Password<br />
                  John Doe,john@school.com,Teacher@123<br />
                  Jane Smith,jane@school.com,Teacher@456
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default UploadPage;
