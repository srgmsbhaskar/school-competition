import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const AdminSettings: React.FC = () => {
  const [googleDrivePath, setGoogleDrivePath] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('key', 'google_drive_path')
          .single();

        if (data) {
          setGoogleDrivePath(data.value || '');
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('app_settings').upsert({
        key: 'google_drive_path',
        value: googleDrivePath,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      });

      if (error) throw error;

      toast({
        title: 'Settings Saved',
        description: 'Your settings have been updated successfully',
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout title="System Settings">
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Storage Settings</CardTitle>
            <CardDescription>
              Configure where competition data and certificates are stored
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="drivePath">Google Drive Path</Label>
              <Input
                id="drivePath"
                value={googleDrivePath}
                onChange={(e) => setGoogleDrivePath(e.target.value)}
                placeholder="Enter Google Drive folder path or ID"
              />
              <p className="text-xs text-muted-foreground">
                Specify the Google Drive folder where competition data will be stored
              </p>
            </div>

            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
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
