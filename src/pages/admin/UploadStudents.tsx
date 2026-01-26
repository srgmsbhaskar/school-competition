import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  parseAndValidateCSV, 
  validateFile, 
  MAX_FILE_SIZE,
  type ValidatedStudentRow,
  type ValidationError 
} from '@/lib/csvValidation';

const UploadStudents: React.FC = () => {
  const [academicYear, setAcademicYear] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [csvData, setCsvData] = useState<ValidatedStudentRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => `${currentYear - 2 + i}-${currentYear - 1 + i}`);
  const classes = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file before processing
    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
      toast({
        title: 'Invalid File',
        description: fileValidation.error,
        variant: 'destructive',
      });
      e.target.value = ''; // Reset input
      return;
    }

    if (!selectedClass) {
      toast({
        title: 'Select Class First',
        description: 'Please select a class before uploading the CSV file',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const result = parseAndValidateCSV(text, parseInt(selectedClass));
      
      setCsvData(result.validRows);
      setValidationErrors(result.errors);
      setUploadStatus('idle');

      if (result.errors.length > 0) {
        toast({
          title: 'Validation Warnings',
          description: `${result.errors.length} row(s) have validation issues. ${result.validRows.length} valid rows ready for upload.`,
          variant: 'destructive',
        });
      } else if (result.validRows.length > 0) {
        toast({
          title: 'File Parsed Successfully',
          description: `${result.validRows.length} students ready for upload`,
        });
      }
    };
    reader.onerror = () => {
      toast({
        title: 'File Read Error',
        description: 'Failed to read the CSV file',
        variant: 'destructive',
      });
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!academicYear || !selectedClass || csvData.length === 0) {
      toast({
        title: 'Missing Information',
        description: 'Please select academic year, class, and upload a valid CSV file',
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
      setValidationErrors([]);
    } catch (error: unknown) {
      console.error('Error uploading students:', error);
      setUploadStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload students';
      toast({
        title: 'Error',
        description: errorMessage,
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
              Upload a CSV file with student information for a specific class and academic year.
              Maximum file size: {MAX_FILE_SIZE / (1024 * 1024)}MB
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
                  Upload a CSV file with columns: S No, Admission No, Name, DOB (YYYY-MM-DD), Section
                </p>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="max-w-xs mx-auto"
                />
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
                      <li key={idx}>
                        Row {err.row}: {err.field} - {err.message}
                      </li>
                    ))}
                    {validationErrors.length > 10 && (
                      <li className="text-amber-600 font-medium">
                        ... and {validationErrors.length - 10} more errors
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {csvData.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Preview ({csvData.length} valid students)</h3>
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
              Your CSV file should have the following columns. Date format must be YYYY-MM-DD.
            </p>
            <div className="bg-muted p-4 rounded-md font-mono text-sm">
              S No,Admission No,Name,DOB,Section<br />
              1,ADM001,John Doe,2015-05-15,A<br />
              2,ADM002,Jane Smith,2015-08-22,A<br />
              3,ADM003,Mike Johnson,2015-03-10,B
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              <strong>Validation Rules:</strong>
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
              <li>Names: Only letters, spaces, periods, hyphens, and apostrophes allowed</li>
              <li>Admission No: Only letters, numbers, hyphens, and underscores allowed</li>
              <li>DOB: Must be in YYYY-MM-DD format (e.g., 2015-05-15)</li>
              <li>Section: Only letters and numbers allowed</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UploadStudents;
