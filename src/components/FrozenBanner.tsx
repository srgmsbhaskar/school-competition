import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Snowflake } from 'lucide-react';

interface FrozenBannerProps {
  competitionFrozen?: boolean;
  competitionName?: string;
}

export const FrozenBanner: React.FC<FrozenBannerProps> = ({ competitionFrozen, competitionName }) => {
  const { isFrozen, academicYear, role } = useAuth();

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

  // Show academic year freeze for all non-admin/coordinator roles
  if (!isFrozen || role === 'admin' || role === 'coordinator') return null;

  return (
    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6 flex items-center gap-3">
      <Lock className="h-5 w-5 text-destructive flex-shrink-0" />
      <div>
        <p className="font-semibold text-destructive">Academic Year {academicYear} is Frozen</p>
        <p className="text-sm text-destructive/80">
          All functions except reports are currently disabled. Contact your administrator for more information.
        </p>
      </div>
    </div>
  );
};
