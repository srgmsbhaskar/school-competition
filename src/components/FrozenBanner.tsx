import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lock } from 'lucide-react';

export const FrozenBanner: React.FC = () => {
  const { isFrozen, academicYear, role } = useAuth();

  if (!isFrozen || role !== 'teacher') return null;

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
