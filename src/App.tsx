import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import StudentDatabase from "./pages/admin/StudentDatabase";
import UploadStudents from "./pages/admin/UploadStudents";
import AdminSettings from "./pages/admin/AdminSettings";

// Coordinator Pages
import CoordinatorDashboard from "./pages/coordinator/CoordinatorDashboard";
import CompetitionsPage from "./pages/coordinator/CompetitionsPage";
import EventsPage from "./pages/coordinator/EventsPage";
import AssignTeachers from "./pages/coordinator/AssignTeachers";
import PrizesPage from "./pages/coordinator/PrizesPage";
import ReportsPage from "./pages/coordinator/ReportsPage";

// Teacher Pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherCompetitions from "./pages/teacher/TeacherCompetitions";
import SelectStudents from "./pages/teacher/SelectStudents";

const queryClient = new QueryClient();

const RoleBasedRedirect = () => {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  switch (role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'coordinator':
      return <Navigate to="/coordinator" replace />;
    case 'teacher':
      return <Navigate to="/teacher" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
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
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <UserManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/students" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <StudentDatabase />
        </ProtectedRoute>
      } />
      <Route path="/admin/upload" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <UploadStudents />
        </ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminSettings />
        </ProtectedRoute>
      } />

      {/* Coordinator Routes */}
      <Route path="/coordinator" element={
        <ProtectedRoute allowedRoles={['coordinator', 'admin']}>
          <CoordinatorDashboard />
        </ProtectedRoute>
      } />
      <Route path="/coordinator/competitions" element={
        <ProtectedRoute allowedRoles={['coordinator', 'admin']}>
          <CompetitionsPage />
        </ProtectedRoute>
      } />
      <Route path="/coordinator/events" element={
        <ProtectedRoute allowedRoles={['coordinator', 'admin']}>
          <EventsPage />
        </ProtectedRoute>
      } />
      <Route path="/coordinator/assign-teachers" element={
        <ProtectedRoute allowedRoles={['coordinator', 'admin']}>
          <AssignTeachers />
        </ProtectedRoute>
      } />
      <Route path="/coordinator/prizes" element={
        <ProtectedRoute allowedRoles={['coordinator', 'admin']}>
          <PrizesPage />
        </ProtectedRoute>
      } />
      <Route path="/coordinator/reports" element={
        <ProtectedRoute allowedRoles={['coordinator', 'admin']}>
          <ReportsPage />
        </ProtectedRoute>
      } />

      {/* Teacher Routes */}
      <Route path="/teacher" element={
        <ProtectedRoute allowedRoles={['teacher']}>
          <TeacherDashboard />
        </ProtectedRoute>
      } />
      <Route path="/teacher/competitions" element={
        <ProtectedRoute allowedRoles={['teacher']}>
          <TeacherCompetitions />
        </ProtectedRoute>
      } />
      <Route path="/teacher/select-students" element={
        <ProtectedRoute allowedRoles={['teacher']}>
          <SelectStudents />
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
