import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
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
  ArrowLeft,
  Lock,
  Snowflake,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const departmentLabels: Record<string, string> = {
  external: 'External Competition',
  internal: 'Internal Competition',
  sports: 'Sports',
  other: 'Other Competition',
};

// Color palette for competitions in sidebar
const competitionColors = [
  'text-blue-600',
  'text-emerald-600',
  'text-purple-600',
  'text-orange-600',
  'text-rose-600',
  'text-cyan-600',
  'text-amber-600',
  'text-indigo-600',
  'text-teal-600',
  'text-pink-600',
];

interface CompetitionItem {
  id: string;
  name: string;
  color: string;
}

export const AppSidebar: React.FC = () => {
  const { role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { department } = useParams<{ department: string }>();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const canChangePassword = role === 'coordinator' || role === 'department_incharge' || role === 'teacher';

  const adminMenuItems = [
    { title: 'Dashboard', icon: Home, path: '/admin' },
    { title: 'User Management', icon: UserPlus, path: '/admin/users' },
    { title: 'Student Database', icon: Users, path: '/admin/students' },
    { title: 'Upload', icon: Upload, path: '/admin/upload' },
    { title: 'Freeze', icon: Snowflake, path: '/admin/freeze' },
    { title: 'Settings', icon: Settings, path: '/admin/settings' },
  ];

  const getCoordinatorMenuItems = () => {
    if (department) {
      const backPath = role === 'department_incharge' ? undefined : '/coordinator';
      const items = [];
      if (backPath) {
        items.push({ title: '← Back to Departments', icon: ArrowLeft, path: backPath });
      }
      items.push(
        { title: 'Competitions', icon: Trophy, path: `/coordinator/${department}/competitions` },
        { title: 'Events', icon: Calendar, path: `/coordinator/${department}/events` },
        { title: 'Assign Teachers', icon: ClipboardList, path: `/coordinator/${department}/assign-teachers` },
        { title: 'Select Students', icon: Users, path: `/coordinator/${department}/select-students` },
        { title: 'Prizes', icon: Award, path: `/coordinator/${department}/prizes` },
        { title: 'Reports', icon: FileText, path: `/coordinator/${department}/reports` },
      );
      return items;
    }
    return [
      { title: 'Dashboard', icon: Home, path: '/coordinator' },
    ];
  };

  const getDeptInchargeMenuItems = () => {
    if (!department) return [];
    return [
      { title: 'Competitions', icon: Trophy, path: `/coordinator/${department}/competitions` },
      { title: 'Events', icon: Calendar, path: `/coordinator/${department}/events` },
      { title: 'Assign Teachers', icon: ClipboardList, path: `/coordinator/${department}/assign-teachers` },
      { title: 'Select Students', icon: Users, path: `/coordinator/${department}/select-students` },
      { title: 'Prizes', icon: Award, path: `/coordinator/${department}/prizes` },
      { title: 'Reports', icon: FileText, path: `/coordinator/${department}/reports` },
    ];
  };

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
        return getCoordinatorMenuItems();
      case 'department_incharge':
        return getDeptInchargeMenuItems();
      case 'teacher':
        return teacherMenuItems;
      default:
        return [];
    }
  };

  const menuItems = getMenuItems();
  const getRoleLabel = () => {
    if (role === 'department_incharge' && department) return departmentLabels[department] || 'Dept In-Charge';
    if (role === 'coordinator' && department) return departmentLabels[department] || 'Coordinator';
    if (role === 'department_incharge') return 'Dept In-Charge';
    return `${role?.charAt(0).toUpperCase()}${role?.slice(1)} Menu`;
  };

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
            {getRoleLabel()}
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

        {/* Dept in-charge: show competitions as separate colored items */}
        {role === 'department_incharge' && department && competitions.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">
              Competitions
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {competitions.map((comp) => (
                  <SidebarMenuItem key={comp.id}>
                    <SidebarMenuButton
                      onClick={() => navigate(`/coordinator/${department}/events?competition=${comp.id}`)}
                      isActive={location.search.includes(comp.id)}
                      tooltip={comp.name}
                    >
                      <Trophy className={`h-4 w-4 ${comp.color}`} />
                      <span className="truncate">{comp.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4 space-y-2">
        {canChangePassword && (
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => navigate('/change-password')}
          >
            <Lock className="mr-2 h-4 w-4" />
            Change Password
          </Button>
        )}
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
