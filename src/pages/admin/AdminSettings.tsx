import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2, Download, Upload, AlertTriangle, Sun, Moon, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';

const AdminSettings: React.FC = () => {
  const [googleDrivePath, setGoogleDrivePath] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark');
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase.from('app_settings').select('*').eq('key', 'google_drive_path').single();
        if (data) setGoogleDrivePath(data.value || '');
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleToggleTheme = (dark: boolean) => {
    setIsDarkMode(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('app_settings').upsert({ key: 'google_drive_path', value: googleDrivePath, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      toast({ title: 'Settings Saved', description: 'Your settings have been updated successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('backup-data', { method: 'GET' });

      if (response.error) throw response.error;

      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: 'Backup Complete', description: 'Data has been downloaded to your computer' });
    } catch (error: any) {
      toast({ title: 'Backup Failed', description: error.message || 'Failed to create backup', variant: 'destructive' });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsRestoring(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data._meta) throw new Error('Invalid backup file format');

      const response = await supabase.functions.invoke('backup-data', {
        method: 'POST',
        body: data,
      });

      if (response.error) throw response.error;

      toast({ title: 'Restore Complete', description: 'Data has been restored successfully. Please refresh the page.' });
    } catch (error: any) {
      toast({ title: 'Restore Failed', description: error.message || 'Failed to restore data', variant: 'destructive' });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <DashboardLayout title="System Settings">
      <div className="space-y-6 animate-fade-in max-w-2xl">
        {/* Theme Toggle */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Switch between Baby Blue theme and Dark mode</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isDarkMode ? <Moon className="h-5 w-5 text-muted-foreground" /> : <Sun className="h-5 w-5 text-amber-500" />}
                <div>
                  <p className="font-medium text-sm">{isDarkMode ? 'Dark Mode' : 'Baby Blue Theme'}</p>
                  <p className="text-xs text-muted-foreground">{isDarkMode ? 'Dark background for low-light use' : 'Light baby blue background'}</p>
                </div>
              </div>
              <Switch checked={isDarkMode} onCheckedChange={handleToggleTheme} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storage Settings</CardTitle>
            <CardDescription>Configure where competition data and certificates are stored</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="drivePath">Google Drive Path</Label>
              <Input id="drivePath" value={googleDrivePath} onChange={(e) => setGoogleDrivePath(e.target.value)} placeholder="Enter Google Drive folder path or ID" />
              <p className="text-xs text-muted-foreground">Specify the Google Drive folder where competition data will be stored</p>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (<><Save className="mr-2 h-4 w-4" />Save Settings</>)}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backup & Restore</CardTitle>
            <CardDescription>Download a full backup of all competition data or restore from a previous backup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button onClick={handleBackup} disabled={isBackingUp} variant="outline">
                {isBackingUp ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Backup...</>) : (<><Download className="mr-2 h-4 w-4" />Download Backup</>)}
              </Button>

              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleRestore} />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isRestoring}>
                    {isRestoring ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Restoring...</>) : (<><Upload className="mr-2 h-4 w-4" />Restore from Backup</>)}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Restore Data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will replace ALL existing competition data with the backup file. This action cannot be undone. Make sure to download a current backup first.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => fileInputRef.current?.click()}>Select Backup File</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <p className="text-xs text-muted-foreground">Backup includes: students, competitions, events, participations, prizes, and teacher assignments</p>
          </CardContent>
        </Card>

        {/* User Guides */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />User Guides</CardTitle>
            <CardDescription>Download PDF guides for each user role with step-by-step instructions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Admin Guide', file: 'admin_guide.pdf', desc: 'Dashboard, users, students, settings' },
                { label: 'Coordinator Guide', file: 'coordinator_guide.pdf', desc: 'Competitions, events, teachers, prizes' },
                { label: 'Dept In-Charge Guide', file: 'dept_incharge_guide.pdf', desc: 'Department-scoped management' },
                { label: 'Teacher Guide', file: 'teacher_guide.pdf', desc: 'Competitions, student selection' },
              ].map((guide) => (
                <a
                  key={guide.file}
                  href={`/guides/${guide.file}`}
                  download
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <FileText className="h-8 w-8 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{guide.label}</p>
                    <p className="text-xs text-muted-foreground">{guide.desc}</p>
                  </div>
                  <Download className="h-4 w-4 ml-auto text-muted-foreground shrink-0" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>Competition Management System</strong></p>
              <p>Version 1.0.0</p>
              <p>Manage external competitions, events, and student participations.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminSettings;
