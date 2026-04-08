import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Garage = lazy(() => import("./pages/Garage"));
const VehicleDetail = lazy(() => import("./pages/VehicleDetail"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const DiagnosisSession = lazy(() => import("./pages/DiagnosisSession"));
const Projects = lazy(() => import("./pages/Projects"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/garage" element={<ProtectedRoute><Garage /></ProtectedRoute>} />
              <Route path="/garage/:vehicleId" element={<ProtectedRoute><VehicleDetail /></ProtectedRoute>} />
              <Route path="/garage/:vehicleId/projects/:projectId" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
              <Route path="/garage/:vehicleId/diagnose/:diagnosisId" element={<ProtectedRoute><DiagnosisSession /></ProtectedRoute>} />
              <Route path="/active-work" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              {/* Legacy redirects */}
              <Route path="/projects" element={<Navigate to="/active-work" replace />} />
              <Route path="/maintenance" element={<Navigate to="/garage" replace />} />
              <Route path="/repairs" element={<Navigate to="/garage" replace />} />
              <Route path="/chat" element={<Navigate to="/garage" replace />} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
