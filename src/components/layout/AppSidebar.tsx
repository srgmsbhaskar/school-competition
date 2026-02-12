import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  Trophy,
  Users,
  Calendar,
  Award,
  FileText,
  Settings,
  LogOut,
  Home,
  UserPlus,
  Upload,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const AppSidebar: React.FC = () => {
  const { role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const adminMenuItems = [
    { title: 'Dashboard', icon: Home, path: '/admin' },
    { title: 'User Management', icon: UserPlus, path: '/admin/users' },
    { title: 'Student Database', icon: Users, path: '/admin/students' },
    { title: 'Upload Students', icon: Upload, path: '/admin/upload' },
    { title: 'Settings', icon: Settings, path: '/admin/settings' },
  ];

  const coordinatorMenuItems = [
    { title: 'Dashboard', icon: Home, path: '/coordinator' },
    { title: 'Competitions', icon: Trophy, path: '/coordinator/competitions' },
    { title: 'Events', icon: Calendar, path: '/coordinator/events' },
    { title: 'Assign Teachers', icon: ClipboardList, path: '/coordinator/assign-teachers' },
    { title: 'Select Students', icon: Users, path: '/coordinator/select-students' },
    { title: 'Prizes', icon: Award, path: '/coordinator/prizes' },
    { title: 'Reports', icon: FileText, path: '/coordinator/reports' },
  ];

  const teacherMenuItems = [
    { title: 'Dashboard', icon: Home, path: '/teacher' },
    { title: 'My Competitions', icon: Trophy, path: '/teacher/competitions' },
    { title: 'Select Students', icon: Users, path: '/teacher/select-students' },
  ];

  const getMenuItems = () => {
    switch (role) {
      case 'admin':
        return adminMenuItems;
      case 'coordinator':
        return coordinatorMenuItems;
      case 'teacher':
        return teacherMenuItems;
      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <Trophy className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sidebar-foreground">Competition</h2>
            <p className="text-xs text-sidebar-foreground/70">Management System</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            {role?.charAt(0).toUpperCase() + role?.slice(1)} Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={location.pathname === item.path}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};
