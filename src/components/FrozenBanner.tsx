import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Snowflake, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface FrozenBannerProps {
  competitionFrozen?: boolean;
  competitionName?: string;
}

/**
 * Full-page freeze overlay for non-admin users when academic year is frozen.
 * Nothing is visible — just the freeze message and sign out.
 */
export const FrozenOverlay: React.FC = () => {
  const { academicYear, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <Lock className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">System Frozen</h1>
        <p className="text-muted-foreground">
          Academic year <strong>{academicYear}</strong> has been frozen by the administrator.
          No data is accessible until the admin unfreezes the system.
        </p>
        <p className="text-sm text-muted-foreground">
          Please contact your administrator for more information.
        </p>
        <Button onClick={handleSignOut} variant="outline" className="gap-2">
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export const FrozenBanner: React.FC<FrozenBannerProps> = ({ competitionFrozen, competitionName }) => {
  const { role } = useAuth();

  // Show competition-level freeze banner for dept incharge and teachers
  if (competitionFrozen && (role === 'department_incharge' || role === 'teacher')) {
    return (
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-6 flex items-center gap-3">
        <Snowflake className="h-5 w-5 text-orange-600 flex-shrink-0" />
        <div>
          <p className="font-semibold text-orange-700">Competition "{competitionName}" is Frozen</p>
          <p className="text-sm text-orange-600/80">
            This competition has been frozen by the coordinator. No editing or creating is allowed. Contact an admin or coordinator to unfreeze.
          </p>
        </div>
      </div>
    );
  }

  return null;
};
