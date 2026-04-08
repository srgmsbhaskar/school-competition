import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { useParams } from 'react-router-dom';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const { user, role, academicYear } = useAuth();
  const { department } = useParams<{ department: string }>();

  const deptClass = department ? `dept-${department} dept-watermark` : '';

  return (
    <SidebarProvider className={deptClass}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {title && (
            <h1 className="text-lg font-semibold" style={{ color: 'hsl(var(--primary))' }}>
              {title}
            </h1>
          )}
          <div className="ml-auto flex items-center gap-4">
            {role !== 'admin' && role !== 'coordinator' && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium">
                AY: {academicYear}
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              {user?.email}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 relative z-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
