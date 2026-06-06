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
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Settings from './pages/Settings';
import ReceiptHistory from './pages/ReceiptHistory';
import DeveloperPanel from './pages/DeveloperPanel';
import Reports from './pages/Reports';
import CashManagement from './pages/CashManagement';
import Accounting from './pages/Accounting';
import Messenger from './pages/Messenger';
import { Toaster } from './components/ui/sonner';
import { syncRBZExchangeRates } from './services/currencyService';

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
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dev-portal" element={<ProtectedRoute><DeveloperPanel /></ProtectedRoute>} />
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/receipts" element={<ReceiptHistory />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/cash" element={<CashManagement />} />
                <Route path="/accounting" element={<Accounting />} />
                <Route path="/messenger" element={<Messenger />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
