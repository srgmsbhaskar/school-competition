import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StudentRow {
  s_no: number;
  admission_no: string;
  name: string;
  dob: string;
  class: number;
  section: string;
}

const UploadStudents: React.FC = () => {
  const [academicYear, setAcademicYear] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [csvData, setCsvData] = useState<StudentRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => `${currentYear - 2 + i}-${currentYear - 1 + i}`);
  const classes = Array.from({ length: 12 }, (_, i) => i + 1);

  const parseCSV = (text: string): StudentRow[] => {
    const lines = text.trim().split('\n');
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    const rows: StudentRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length >= 5) {
        rows.push({
          s_no: parseInt(values[headers.indexOf('s no')] || values[headers.indexOf('sno')] || values[0]) || i,
          admission_no: values[headers.indexOf('admission no')] || values[headers.indexOf('admission_no')] || values[1],
          name: values[headers.indexOf('name')] || values[2],
          dob: values[headers.indexOf('dob')] || values[headers.indexOf('date of birth')] || values[3],
          class: parseInt(selectedClass),
          section: values[headers.indexOf('sec')] || values[headers.indexOf('section')] || values[4],
        });
      }
    }
    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setCsvData(parsed);
      setUploadStatus('idle');
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!academicYear || !selectedClass || csvData.length === 0) {
      toast({
        title: 'Missing Information',
        description: 'Please select academic year, class, and upload a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const studentsToInsert = csvData.map((row) => ({
        s_no: row.s_no,
        admission_no: row.admission_no,
        name: row.name,
        dob: row.dob,
        class: parseInt(selectedClass),
        section: row.section,
        academic_year: academicYear,
      }));

      const { error } = await supabase.from('students').upsert(studentsToInsert, {
        onConflict: 'admission_no',
      });

      if (error) throw error;

      setUploadStatus('success');
      toast({
        title: 'Success',
        description: `${csvData.length} students uploaded successfully`,
      });
      setCsvData([]);
    } catch (error: any) {
      console.error('Error uploading students:', error);
      setUploadStatus('error');
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload students',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout title="Upload Students">
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle>Upload Student Data</CardTitle>
            <CardDescription>
              Upload a CSV file with student information for a specific class and academic year
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="year">Academic Year</Label>
                <Select value={academicYear} onValueChange={setAcademicYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select academic year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c} value={c.toString()}>
                        Class {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>CSV File</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a CSV file with columns: S No, Admission No, Name, DOB, Section
                </p>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="max-w-xs mx-auto"
                />
              </div>
            </div>

            {csvData.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Preview ({csvData.length} students)</h3>
                  <Button onClick={handleUpload} disabled={isUploading}>
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Students
                      </>
                    )}
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
                <span>Students uploaded successfully!</span>
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

        <Card>
          <CardHeader>
            <CardTitle>CSV Format Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Your CSV file should have the following columns:
            </p>
            <div className="bg-muted p-4 rounded-md font-mono text-sm">
              S No,Admission No,Name,DOB,Section<br />
              1,ADM001,John Doe,2015-05-15,A<br />
              2,ADM002,Jane Smith,2015-08-22,A<br />
              3,ADM003,Mike Johnson,2015-03-10,B
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UploadStudents;
