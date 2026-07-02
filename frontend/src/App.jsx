import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import Sidebar from './components/Sidebar';
import { LoadingSpinner, ErrorBoundary } from './components/Common';
import { FaBars } from 'react-icons/fa';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Accounts = lazy(() => import('./pages/Accounts'));
const ScanPage = lazy(() => import('./pages/Scan'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Reports = lazy(() => import('./pages/Reports'));
const Budgets = lazy(() => import('./pages/Budgets'));
const SavingsGoals = lazy(() => import('./pages/SavingsGoals'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));

function ProtectedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-6" id="main-content">
        <button
          type="button"
          className="md:hidden fixed top-3 left-3 z-30 bg-secondary border border-default text-primary p-2 rounded-lg"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <FaBars aria-hidden="true" />
        </button>
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/savings-goals" element={<SavingsGoals />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/*" element={user ? <ProtectedLayout /> : <Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
