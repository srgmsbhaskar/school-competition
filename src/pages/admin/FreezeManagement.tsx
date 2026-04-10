import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const FreezeManagement: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState('');
  const [frozenYears, setFrozenYears] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear - 2 + i;
    return `${y}-${y + 1}`;
  });

  const fetchFrozenYears = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .like('key', 'freeze_%');

      const frozen = (data || [])
        .filter((d) => d.value === 'true')
        .map((d) => d.key.replace('freeze_', ''));

      setFrozenYears(frozen);
    } catch (error) {
      console.error('Error fetching freeze status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFrozenYears();
  }, []);

  const handleFreeze = async () => {
    if (!selectedYear) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('app_settings').upsert(
        { key: `freeze_${selectedYear}`, value: 'true', updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;

      toast({ title: 'Year Frozen', description: `Academic year ${selectedYear} has been frozen. All users except admin can only view reports.` });
      setSelectedYear('');
      fetchFrozenYears();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to freeze year', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnfreeze = async (year: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('app_settings').upsert(
        { key: `freeze_${year}`, value: 'false', updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;

      toast({ title: 'Year Unfrozen', description: `Academic year ${year} has been unfrozen.` });
      fetchFrozenYears();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to unfreeze year', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const unfrozenYears = years.filter((y) => !frozenYears.includes(y));

  return (
    <DashboardLayout title="Freeze Management">
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Freeze Academic Year
            </CardTitle>
            <CardDescription>
              When an academic year is frozen, <strong>all users except admin</strong> will be blocked from all functions except viewing/downloading reports.
              Coordinators can additionally freeze individual competitions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {unfrozenYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleFreeze} disabled={!selectedYear || isSaving}>
                {isSaving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Freezing...</>
                ) : (
                  <><Lock className="mr-2 h-4 w-4" />Freeze Year</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Frozen Years</CardTitle>
            <CardDescription>Currently frozen academic years</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : frozenYears.length === 0 ? (
              <p className="text-muted-foreground text-sm">No academic years are currently frozen.</p>
            ) : (
              <div className="space-y-3">
                {frozenYears.map((year) => (
                  <div key={year} className="flex items-center justify-between p-3 rounded-lg border bg-destructive/5">
                    <div className="flex items-center gap-3">
                      <Lock className="h-4 w-4 text-destructive" />
                      <span className="font-medium">{year}</span>
                      <Badge variant="destructive">Frozen</Badge>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleUnfreeze(year)} disabled={isSaving}>
                      <Unlock className="mr-2 h-4 w-4" />
                      Unfreeze
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default FreezeManagement;
