/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './components/ThemeProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import { Toaster } from './components/ui/sonner';
import { syncRBZExchangeRates } from './services/currencyService';

// Code-splitting via dynamic imports for optimized initial load sizes
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const POS = React.lazy(() => import('./pages/POS'));
const Inventory = React.lazy(() => import('./pages/Inventory'));
const Customers = React.lazy(() => import('./pages/Customers'));
const Suppliers = React.lazy(() => import('./pages/Suppliers'));
const Settings = React.lazy(() => import('./pages/Settings'));
const ChartOfAccounts = React.lazy(() => import('./pages/ChartOfAccounts'));
const DeveloperPanel = React.lazy(() => import('./pages/DeveloperPanel'));
const Reports = React.lazy(() => import('./pages/Reports'));
const CashManagement = React.lazy(() => import('./pages/CashManagement'));
const Accounting = React.lazy(() => import('./pages/Accounting'));
const Messenger = React.lazy(() => import('./pages/Messenger'));
const Roadmap = React.lazy(() => import('./pages/Roadmap'));

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="h-screen w-full flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
};

export default function App() {
  React.useEffect(() => {
    // Non-blocking background sync of exchange rates daily
    syncRBZExchangeRates(false).catch(err => {
      console.warn('Background currency rate sync soft failure:', err);
    });
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" disableTransitionOnChange>
        <AuthProvider>
          <BrowserRouter>
            <React.Suspense fallback={
              <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <div className="w-8 h-8 rounded-full border-4 border-zinc-200 border-t-zinc-900 animate-spin mb-4" />
                <p className="text-zinc-500 text-sm font-medium animate-pulse">Loading Tareza ERP...</p>
              </div>
            }>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dev-portal" element={<ProtectedRoute><DeveloperPanel /></ProtectedRoute>} />
                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/pos" element={<POS />} />
                  <Route path="/coa" element={<ChartOfAccounts />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/cash" element={<CashManagement />} />
                  <Route path="/accounting" element={<Accounting />} />
                  <Route path="/messenger" element={<Messenger />} />
                  <Route path="/roadmap" element={<Roadmap />} />
                </Route>
              </Routes>
            </React.Suspense>
          </BrowserRouter>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
