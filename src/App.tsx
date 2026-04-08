import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import Login from "./pages/Login";

import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import StudentDatabase from "./pages/admin/StudentDatabase";
import UploadStudents from "./pages/admin/UploadStudents";
import AdminSettings from "./pages/admin/AdminSettings";
import FreezeManagement from "./pages/admin/FreezeManagement";

// Coordinator Pages
import CoordinatorDashboard from "./pages/coordinator/CoordinatorDashboard";
import CompetitionsPage from "./pages/coordinator/CompetitionsPage";
import EventsPage from "./pages/coordinator/EventsPage";
import AssignTeachers from "./pages/coordinator/AssignTeachers";
import PrizesPage from "./pages/coordinator/PrizesPage";
import ReportsPage from "./pages/coordinator/ReportsPage";
import CoordinatorSelectStudents from "./pages/coordinator/SelectStudents";

// Teacher Pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherCompetitions from "./pages/teacher/TeacherCompetitions";
import SelectStudents from "./pages/teacher/SelectStudents";

const queryClient = new QueryClient();

const RoleBasedRedirect = () => {
  const { role, assignedDepartment, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  switch (role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'coordinator':
      return <Navigate to="/coordinator" replace />;
    case 'department_incharge':
      return <Navigate to={`/coordinator/${assignedDepartment || 'external'}/competitions`} replace />;
    case 'teacher':
      return <Navigate to="/teacher" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

const CoordinatorRoute = ({ children }: { children: React.ReactNode }) => {
  const { role, assignedDepartment, isLoading } = useAuth();
  const location = useLocation();

  const pathMatch = location.pathname.match(/\/coordinator\/([^/]+)/);
  const urlDepartment = pathMatch ? pathMatch[1] : null;

  if (!isLoading && role === 'department_incharge' && assignedDepartment && urlDepartment && urlDepartment !== assignedDepartment) {
    const newPath = location.pathname.replace(
      `/coordinator/${urlDepartment}`,
      `/coordinator/${assignedDepartment}`
    );
    return <Navigate to={newPath + location.search} replace />;
  }

  return (
    <ProtectedRoute allowedRoles={['coordinator', 'admin', 'department_incharge']}>
      {children}
    </ProtectedRoute>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <RoleBasedRedirect />
        </ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute allowedRoles={['admin']}><StudentDatabase /></ProtectedRoute>} />
      <Route path="/admin/upload" element={<ProtectedRoute allowedRoles={['admin']}><UploadStudents /></ProtectedRoute>} />
      <Route path="/admin/freeze" element={<ProtectedRoute allowedRoles={['admin']}><FreezeManagement /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><AdminSettings /></ProtectedRoute>} />

      {/* Coordinator Dashboard */}
      <Route path="/coordinator" element={<CoordinatorRoute><CoordinatorDashboard /></CoordinatorRoute>} />

      {/* Coordinator Department Routes */}
      <Route path="/coordinator/:department/competitions" element={<CoordinatorRoute><CompetitionsPage /></CoordinatorRoute>} />
      <Route path="/coordinator/:department/events" element={<CoordinatorRoute><EventsPage /></CoordinatorRoute>} />
      <Route path="/coordinator/:department/assign-teachers" element={<CoordinatorRoute><AssignTeachers /></CoordinatorRoute>} />
      <Route path="/coordinator/:department/prizes" element={<CoordinatorRoute><PrizesPage /></CoordinatorRoute>} />
      <Route path="/coordinator/:department/reports" element={<CoordinatorRoute><ReportsPage /></CoordinatorRoute>} />
      <Route path="/coordinator/:department/select-students" element={<CoordinatorRoute><CoordinatorSelectStudents /></CoordinatorRoute>} />

      {/* Teacher Routes */}
      <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/competitions" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherCompetitions /></ProtectedRoute>} />
      <Route path="/teacher/select-students" element={<ProtectedRoute allowedRoles={['teacher']}><SelectStudents /></ProtectedRoute>} />

      {/* Change Password */}
      <Route path="/change-password" element={
        <ProtectedRoute allowedRoles={['coordinator', 'department_incharge', 'teacher']}>
          <ChangePassword />
        </ProtectedRoute>
      } />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
