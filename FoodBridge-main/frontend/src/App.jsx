import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleGuard } from './components/RoleGuard';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { DonorDashboard } from './pages/DonorDashboard';
import { NgoDashboard } from './pages/NgoDashboard';
import { NgoRoutePlanner } from './pages/NgoRoutePlanner';
import { AdminDashboard } from './pages/AdminDashboard';

const HomeRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN' || user.is_superuser) return <Navigate to="/dashboard/admin" replace />;
  if (user.role === 'NGO') return <Navigate to="/dashboard/ngo" replace />;
  return <Navigate to="/dashboard/donor" replace />;
};

export const App = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-warm-100 text-slate-800 font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              <Route
                path="/dashboard/donor"
                element={
                  <ProtectedRoute>
                    <RoleGuard allowedRoles={['DONOR', 'ADMIN']}>
                      <DonorDashboard />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard/ngo"
                element={
                  <ProtectedRoute>
                    <RoleGuard allowedRoles={['NGO', 'ADMIN']}>
                      <NgoDashboard />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard/ngo/route"
                element={
                  <ProtectedRoute>
                    <RoleGuard allowedRoles={['NGO', 'ADMIN']}>
                      <NgoRoutePlanner />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard/admin"
                element={
                  <ProtectedRoute>
                    <RoleGuard allowedRoles={['ADMIN']}>
                      <AdminDashboard />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<HomeRedirect />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
